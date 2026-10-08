import { prisma } from "@/lib/prisma";
import { formatINR, formatSharePrice } from "@/lib/formatters";
import { getUserDisplayIdentifier } from "@/lib/tokens";
import { getCached, setCached, invalidateCache } from "@/lib/cache";
import type { OrderSide, OrderType, OrderBookResponse, OrderBookLevel } from "@/types";

export interface PlaceOrderInput {
  userId: string;
  startupId: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number; // Required for LIMIT, optional for MARKET
}

export interface TradeResult {
  tradeId: string;
  price: number;
  quantity: number;
  amount: number;
  buyerId: string;
  sellerId: string;
}

export interface PlaceOrderResult {
  success: boolean;
  orderId: string;
  status: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "REJECTED";
  filledQuantity: number;
  remainingQuantity: number;
  averageExecutionPrice: number;
  totalExecutedAmount: number;
  trades: TradeResult[];
  message: string;
  newBalance: number;
  newLtp?: number;
}

/**
 * Responsive & Balanced Market Maker Tier Configuration:
 * Granular price progression calibrated for audience pitch trading.
 * Buying moves price up noticeably (+0.8%, +1.6%, +2.5%, +3.5%...),
 * Selling moves price down symmetrically (-0.8%, -1.6%, -2.5%, -3.5%...).
 */
export const BALANCED_MM_TIERS = [
  { pct: 0.008, qty: 25 },    // ±0.8% (25 shares)
  { pct: 0.016, qty: 50 },    // ±1.6% (50 shares)
  { pct: 0.025, qty: 75 },    // ±2.5% (75 shares)
  { pct: 0.035, qty: 100 },   // ±3.5% (100 shares)
  { pct: 0.048, qty: 150 },   // ±4.8% (150 shares)
  { pct: 0.062, qty: 200 },   // ±6.2% (200 shares)
  { pct: 0.078, qty: 300 },   // ±7.8% (300 shares)
  { pct: 0.095, qty: 500 },   // ±9.5% (500 shares)
  { pct: 0.115, qty: 750 },   // ±11.5% (750 shares)
  { pct: 0.140, qty: 1000 },  // ±14.0% (1,000 shares)
  { pct: 0.170, qty: 2000 },  // ±17.0% (2,000 shares)
  { pct: 0.210, qty: 5000 },  // ±21.0% (5,000 shares)
  { pct: 0.260, qty: 10000 }, // ±26.0% (10,000 shares)
  { pct: 0.320, qty: 25000 }, // ±32.0% (25,000 shares)
];

/**
 * Executes a Buy or Sell Order atomically using an ultra-optimized matching engine.
 * Batched database updates ensure sub-500ms execution across cross-regional databases.
 */
export async function executeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { userId, startupId, side, type } = input;
  const quantity = Math.floor(input.quantity);

  if (!quantity || quantity <= 0) {
    throw new Error("Order quantity must be a positive integer.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Parallel Lock & Validate
    const [marketState, user, startup] = await Promise.all([
      tx.marketState.findUnique({ where: { id: "global" } }),
      tx.user.findUnique({ where: { id: userId } }),
      tx.startup.findUnique({ where: { id: startupId } }),
    ]);

    if (!marketState || !marketState.isMarketActive) {
      throw new Error("The market is currently CLOSED or PAUSED by event administrators.");
    }

    if (!user || user.status === "BLOCKED") {
      throw new Error("User account is inactive or blocked.");
    }

    if (user.role !== "RETAIL" && user.role !== "FII" && user.role !== "ADMIN") {
      throw new Error("Only registered investors and judges are permitted to trade.");
    }

    if (!startup) {
      throw new Error("Stock / team not found.");
    }

    if (startup.isSuspended) {
      throw new Error(`Trading in ${startup.name} is currently suspended by administrators.`);
    }

    if (startup.ipoStatus !== "IPO_OPEN") {
      throw new Error(`Trading in ${startup.name} is not open (status: ${startup.ipoStatus}).`);
    }

    // 2. Validate Price & Order Type
    let targetPrice = input.price ? Number(input.price) : startup.currentPrice;
    if (type === "LIMIT") {
      if (!input.price || input.price <= 0) {
        throw new Error("Limit orders require a valid positive price.");
      }
      targetPrice = Number(input.price);
    } else {
      targetPrice = startup.currentPrice || 100;
    }

    // 3. Side-specific pre-trade validation & Escrow Locking
    let reservedAmount = 0;

    if (side === "BUY") {
      if (type === "LIMIT") {
        reservedAmount = quantity * targetPrice;
        if (user.currentBalance < reservedAmount) {
          throw new Error(
            `Insufficient cash balance. Required: ${formatINR(reservedAmount)}, Available: ${formatINR(user.currentBalance)}.`
          );
        }
      } else {
        // MARKET BUY: Validate user has at least enough cash for 1 share
        if (user.currentBalance < targetPrice) {
          throw new Error(
            `Insufficient cash balance to execute market buy. Available: ${formatINR(user.currentBalance)}.`
          );
        }
      }
    } else {
      // SELL: Validate user holds sufficient available shares
      const [userHolding, openSellOrders] = await Promise.all([
        tx.holding.findUnique({
          where: { userId_startupId: { userId: user.id, startupId: startup.id } },
        }),
        tx.order.findMany({
          where: {
            userId: user.id,
            startupId: startup.id,
            side: "SELL",
            status: { in: ["OPEN", "PARTIALLY_FILLED"] },
          },
          select: { remainingQuantity: true },
        }),
      ]);

      const currentOwned = userHolding?.quantity || 0;
      const lockedSellShares = openSellOrders.reduce((sum, ord) => sum + ord.remainingQuantity, 0);

      const availableToSell = currentOwned - lockedSellShares;
      if (availableToSell < quantity) {
        throw new Error(
          `Insufficient shares owned. You have ${availableToSell} shares available to sell, attempted to sell ${quantity}.`
        );
      }
    }

    // 4. Create the Incoming Order & 5. Find Opposite Orders for Matching concurrently
    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const oppositeSide = side === "BUY" ? "SELL" : "BUY";

    const [newOrder, initialMatchingOrders] = await Promise.all([
      tx.order.create({
        data: {
          id: orderId,
          userId: user.id,
          startupId: startup.id,
          side,
          type,
          price: targetPrice,
          quantity,
          filledQuantity: 0,
          remainingQuantity: quantity,
          status: "OPEN",
          reservedAmount,
        },
      }),
      tx.order.findMany({
        where: {
          startupId: startup.id,
          side: oppositeSide,
          status: { in: ["OPEN", "PARTIALLY_FILLED"] },
          userId: { not: user.id }, // Self-trade prevention
          ...(type === "LIMIT"
            ? side === "BUY"
              ? { price: { lte: targetPrice } }
              : { price: { gte: targetPrice } }
            : {}),
        },
        orderBy: [
          { price: side === "BUY" ? "asc" : "desc" },
          { createdAt: "asc" },
        ],
        take: 25,
      }),
    ]);

    let matchingOrders = initialMatchingOrders;

    // If order book is empty on opposite side, populate initial balanced liquidity
    if (matchingOrders.length === 0) {
      await rebalanceMarketMakerLiquidity(startup.id, startup.currentPrice, tx);
      matchingOrders = await tx.order.findMany({
        where: {
          startupId: startup.id,
          side: oppositeSide,
          status: { in: ["OPEN", "PARTIALLY_FILLED"] },
          userId: { not: user.id },
          ...(type === "LIMIT"
            ? side === "BUY"
              ? { price: { lte: targetPrice } }
              : { price: { gte: targetPrice } }
            : {}),
        },
        orderBy: [
          { price: side === "BUY" ? "asc" : "desc" },
          { createdAt: "asc" },
        ],
        take: 25,
      });
    }

    // 6. In-Memory Order Matching Engine Loop
    let remainingToFill = quantity;
    let totalExecutedAmount = 0;
    let totalExecutedQuantity = 0;
    let buyerAvailableCash = user.currentBalance;

    const tradesToCreate: any[] = [];
    const executedTrades: TradeResult[] = [];
    const makerOrderUpdates: { id: string; filled: number; remaining: number; status: string }[] = [];

    // Track net changes per participant
    // For sellers: map of sellerId -> { qtySold, cashReceived, trades: { qty, price, amount }[] }
    const sellerDeltas = new Map<string, { qtySold: number; cashReceived: number }>();
    // For buyers: map of buyerId -> { qtyBought, cashPaid }
    const buyerDeltas = new Map<string, { qtyBought: number; cashPaid: number }>();

    for (const makerOrder of matchingOrders) {
      if (remainingToFill <= 0) break;

      const tradeQty = Math.min(remainingToFill, makerOrder.remainingQuantity);
      const tradePrice = makerOrder.price; // Executes at maker's quoted price
      const tradeAmount = Number((tradeQty * tradePrice).toFixed(2));

      // Buyer affordability check
      if (side === "BUY") {
        if (type === "MARKET" && buyerAvailableCash < tradeAmount) {
          const maxAffordable = Math.floor(buyerAvailableCash / tradePrice);
          if (maxAffordable <= 0) break;
          // Trade only what can be afforded
          if (maxAffordable < tradeQty) {
            break;
          }
        }
        buyerAvailableCash -= tradeAmount;
      }

      const tradeId = `TRD-${Math.floor(100000 + Math.random() * 900000)}`;
      const buyerId = side === "BUY" ? user.id : makerOrder.userId;
      const sellerId = side === "SELL" ? user.id : makerOrder.userId;

      tradesToCreate.push({
        id: tradeId,
        startupId: startup.id,
        buyOrderId: side === "BUY" ? newOrder.id : makerOrder.id,
        sellOrderId: side === "SELL" ? newOrder.id : makerOrder.id,
        buyerId,
        sellerId,
        price: tradePrice,
        quantity: tradeQty,
        amount: tradeAmount,
      });

      executedTrades.push({
        tradeId,
        price: tradePrice,
        quantity: tradeQty,
        amount: tradeAmount,
        buyerId,
        sellerId,
      });

      // Update maker order stats
      const newFilled = makerOrder.filledQuantity + tradeQty;
      const newRemaining = makerOrder.remainingQuantity - tradeQty;
      makerOrderUpdates.push({
        id: makerOrder.id,
        filled: newFilled,
        remaining: newRemaining,
        status: newRemaining === 0 ? "FILLED" : "PARTIALLY_FILLED",
      });

      // Accumulate seller deltas
      const sDelta = sellerDeltas.get(sellerId) || { qtySold: 0, cashReceived: 0 };
      sDelta.qtySold += tradeQty;
      sDelta.cashReceived += tradeAmount;
      sellerDeltas.set(sellerId, sDelta);

      // Accumulate buyer deltas
      const bDelta = buyerDeltas.get(buyerId) || { qtyBought: 0, cashPaid: 0 };
      bDelta.qtyBought += tradeQty;
      bDelta.cashPaid += tradeAmount;
      buyerDeltas.set(buyerId, bDelta);

      remainingToFill -= tradeQty;
      totalExecutedQuantity += tradeQty;
      totalExecutedAmount += tradeAmount;
    }

    // 7. Parallelized Batched Database Writes
    if (tradesToCreate.length > 0) {
      const allAffectedUserIds = Array.from(
        new Set([...Array.from(buyerDeltas.keys()), ...Array.from(sellerDeltas.keys())])
      );

      // Pre-fetch all affected holdings, create trades, and update maker orders concurrently in 1 round trip
      const [existingHoldings] = await Promise.all([
        tx.holding.findMany({
          where: {
            startupId: startup.id,
            userId: { in: allAffectedUserIds },
          },
        }),
        tx.trade.createMany({ data: tradesToCreate }),
        ...makerOrderUpdates.map((mUpdate) =>
          tx.order.update({
            where: { id: mUpdate.id },
            data: {
              filledQuantity: mUpdate.filled,
              remainingQuantity: mUpdate.remaining,
              status: mUpdate.status,
            },
          })
        ),
      ]);

      const holdingsMap = new Map(existingHoldings.map((h) => [h.userId, h]));
      const parallelWrites: Promise<any>[] = [];

      // Update Buyer(s) Holdings & Balances
      for (const [bId, bData] of Array.from(buyerDeltas.entries())) {
        const existingHolding = holdingsMap.get(bId);

        if (existingHolding) {
          const newQty = existingHolding.quantity + bData.qtyBought;
          const newInvested = existingHolding.totalInvested + bData.cashPaid;
          const newAvg = newQty > 0 ? Number((newInvested / newQty).toFixed(2)) : targetPrice;
          parallelWrites.push(
            tx.holding.update({
              where: { id: existingHolding.id },
              data: {
                quantity: newQty,
                totalInvested: newInvested,
                averageBuyPrice: newAvg,
              },
            })
          );
        } else {
          parallelWrites.push(
            tx.holding.create({
              data: {
                userId: bId,
                startupId: startup.id,
                quantity: bData.qtyBought,
                averageBuyPrice: Number((bData.cashPaid / bData.qtyBought).toFixed(2)),
                totalInvested: bData.cashPaid,
              },
            })
          );
        }

        // Deduct cash and increment totalInvested
        parallelWrites.push(
          tx.user.update({
            where: { id: bId },
            data: {
              currentBalance: { decrement: bData.cashPaid },
              totalInvested: { increment: bData.cashPaid },
              lastActiveAt: new Date(),
            },
          })
        );
      }

      // Update Seller(s) Holdings & Balances
      for (const [sId, sData] of Array.from(sellerDeltas.entries())) {
        const existingHolding = holdingsMap.get(sId);

        if (existingHolding) {
          const costBasisOfSoldShares = sData.qtySold * existingHolding.averageBuyPrice;
          const realizedPnLDelta = sData.cashReceived - costBasisOfSoldShares;
          const newSellerQty = Math.max(0, existingHolding.quantity - sData.qtySold);
          const newSellerInvested = newSellerQty * existingHolding.averageBuyPrice;

          parallelWrites.push(
            tx.holding.update({
              where: { id: existingHolding.id },
              data: {
                quantity: newSellerQty,
                totalInvested: newSellerInvested,
                realizedPnL: { increment: realizedPnLDelta },
              },
            })
          );
        }

        // Credit cash to seller
        parallelWrites.push(
          tx.user.update({
            where: { id: sId },
            data: {
              currentBalance: { increment: sData.cashReceived },
              lastActiveAt: new Date(),
            },
          })
        );
      }

      // 8. Update Last Traded Price (LTP) & Stock Metrics
      // Dynamic price discovery: LTP is computed with directional movement guarantees
      const lastTrade = executedTrades[executedTrades.length - 1];
      let newLtp = lastTrade.price;

      // Ensure every BUY moves price UP, and every SELL moves price DOWN (minimum 0.05 tick, or higher)
      if (side === "BUY") {
        newLtp = Number(Math.max(startup.currentPrice + 0.05, newLtp).toFixed(2));
      } else {
        newLtp = Number(Math.max(1.00, Math.min(startup.currentPrice - 0.05, newLtp)).toFixed(2));
      }

      const newHigh = Math.max(startup.dayHigh || newLtp, newLtp);
      const newLow = startup.dayLow && startup.dayLow > 0 ? Math.min(startup.dayLow, newLtp) : newLtp;

      parallelWrites.push(
        tx.startup.update({
          where: { id: startup.id },
          data: {
            previousPrice: startup.currentPrice,
            currentPrice: newLtp,
            dayHigh: newHigh,
            dayLow: newLow,
            totalVolume: { increment: totalExecutedQuantity },
            totalInvestmentReceived: { increment: totalExecutedAmount },
            ...(user.role === "RETAIL" && side === "BUY"
              ? { retailInvestment: { increment: totalExecutedAmount } }
              : {}),
            ...(user.role === "FII" && side === "BUY"
              ? { fiiInvestment: { increment: totalExecutedAmount } }
              : {}),
          },
        })
      );

      // Record single PriceHistory entry
      parallelWrites.push(
        tx.priceHistory.create({
          data: {
            startupId: startup.id,
            price: newLtp,
            volume: totalExecutedQuantity,
          },
        })
      );

      // Activity Feed & Legacy Investment Record
      const userDisplayId = getUserDisplayIdentifier(user);
      const actionVerb = side === "BUY" ? "bought" : "sold";

      parallelWrites.push(
        tx.activityFeed.create({
          data: {
            type: "TRADE",
            message: `${userDisplayId} ${actionVerb} ${totalExecutedQuantity} shares of ${startup.name} at ${formatSharePrice(newLtp)}`,
            startupName: startup.name,
            investorName: userDisplayId,
            amount: totalExecutedAmount,
            isPublic: true,
          },
        })
      );

      if (side === "BUY") {
        parallelWrites.push(
          tx.investment.create({
            data: {
              id: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
              investorId: user.id,
              investorName: userDisplayId,
              investorType: user.role === "FII" ? "FII" : "RETAIL",
              startupId: startup.id,
              amount: totalExecutedAmount,
              status: "VALID",
              note: `Market Trade (${totalExecutedQuantity} shares @ ${formatSharePrice(newLtp)})`,
            },
          })
        );
      }

      await Promise.all(parallelWrites);
    }

    // 9. Finalize Incoming Order State
    const finalFilled = totalExecutedQuantity;
    const finalRemaining = quantity - finalFilled;
    let finalStatus: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "REJECTED" = "OPEN";

    if (finalFilled === quantity) {
      finalStatus = "FILLED";
    } else if (finalFilled > 0) {
      finalStatus = "PARTIALLY_FILLED";
    } else {
      finalStatus = "OPEN";
    }

    if (type === "MARKET" && finalRemaining > 0) {
      finalStatus = finalFilled > 0 ? "PARTIALLY_FILLED" : "REJECTED";
    }

    const [, freshUser] = await Promise.all([
      tx.order.update({
        where: { id: newOrder.id },
        data: {
          filledQuantity: finalFilled,
          remainingQuantity: type === "MARKET" ? 0 : finalRemaining,
          status: finalStatus,
        },
      }),
      tx.user.findUniqueOrThrow({ where: { id: user.id } }),
    ]);

    const avgPrice = totalExecutedQuantity > 0 ? totalExecutedAmount / totalExecutedQuantity : targetPrice;

    return {
      orderId: newOrder.id,
      finalStatus,
      finalFilled,
      finalRemaining,
      avgPrice,
      totalExecutedAmount,
      executedTrades,
      currentBalance: freshUser.currentBalance,
      newLtp: executedTrades.length > 0 ? executedTrades[executedTrades.length - 1].price : startup.currentPrice,
    };
  }, {
    maxWait: 8000,
    timeout: 15000,
  });

  // 10. Post-Transaction Background Actions (Non-blocking!)
  // Invalidate cache immediately so all client endpoints read fresh data instantly
  invalidateCache();

  // Asynchronously rebalance market maker orders in the background so next trades execute immediately
  if (result.executedTrades.length > 0) {
    setTimeout(() => {
      rebalanceMarketMakerLiquidity(startupId, result.newLtp).catch((err) => {
        console.warn("Background MM rebalance notice:", err);
      });
    }, 10);
  }

  invalidateCache();

  return {
    success: true,
    orderId: result.orderId,
    status: result.finalStatus,
    filledQuantity: result.finalFilled,
    remainingQuantity: result.finalRemaining,
    averageExecutionPrice: result.avgPrice,
    totalExecutedAmount: result.totalExecutedAmount,
    trades: result.executedTrades,
    message:
      result.finalFilled === quantity
        ? `Order filled! ${side === "BUY" ? "Bought" : "Sold"} ${result.finalFilled} shares at average price ${formatSharePrice(result.avgPrice)}.`
        : result.finalFilled > 0
        ? `Partially filled: ${result.finalFilled} of ${quantity} shares at ${formatSharePrice(result.avgPrice)}.`
        : `Order placed at ${formatSharePrice(result.avgPrice)}. Awaiting matching.`,
    newBalance: result.currentBalance,
    newLtp: result.newLtp,
  };
}

/**
 * Cancels an open or partially filled order and unfreezes reserved cash.
 */
export async function cancelOrder(orderId: string, userId: string): Promise<{ success: boolean; message: string }> {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error("Order not found.");
    }

    if (order.userId !== userId) {
      throw new Error("Unauthorized to cancel this order.");
    }

    if (order.status !== "OPEN" && order.status !== "PARTIALLY_FILLED") {
      throw new Error(`Order cannot be cancelled because it is already ${order.status}.`);
    }

    // If it was a BUY LIMIT order, unfreeze remaining unspent reserved cash
    if (order.side === "BUY" && order.type === "LIMIT") {
      const refundCash = order.remainingQuantity * order.price;
      if (refundCash > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            currentBalance: { increment: refundCash },
          },
        });
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        remainingQuantity: 0,
      },
    });

    invalidateCache();

    return {
      success: true,
      message: `Order ${order.id} cancelled successfully.`,
    };
  }, {
    maxWait: 5000,
    timeout: 10000,
  });
}

/**
 * Returns aggregated Order Book depth (Bids & Asks) for a startup.
 * Cached in memory for 1 second to eliminate database query storms on high-frequency polling.
 */
export async function getOrderBook(startupId: string): Promise<OrderBookResponse> {
  const cacheKey = `orderbook:${startupId}`;
  const cached = getCached<OrderBookResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const [startup, openOrders] = await Promise.all([
    prisma.startup.findUniqueOrThrow({ where: { id: startupId } }),
    prisma.order.findMany({
      where: {
        startupId,
        status: { in: ["OPEN", "PARTIALLY_FILLED"] },
        remainingQuantity: { gt: 0 },
      },
      orderBy: { createdAt: "asc" },
      take: 60,
    }),
  ]);

  // Group bids by price level (descending)
  const bidsMap = new Map<number, { quantity: number; count: number }>();
  // Group asks by price level (ascending)
  const asksMap = new Map<number, { quantity: number; count: number }>();

  openOrders.forEach((o) => {
    if (o.side === "BUY") {
      const current = bidsMap.get(o.price) || { quantity: 0, count: 0 };
      bidsMap.set(o.price, {
        quantity: current.quantity + o.remainingQuantity,
        count: current.count + 1,
      });
    } else {
      const current = asksMap.get(o.price) || { quantity: 0, count: 0 };
      asksMap.set(o.price, {
        quantity: current.quantity + o.remainingQuantity,
        count: current.count + 1,
      });
    }
  });

  const sortedBidPrices = Array.from(bidsMap.keys()).sort((a, b) => b - a);
  const sortedAskPrices = Array.from(asksMap.keys()).sort((a, b) => a - b);

  let maxDepthQty = 1;

  const bids: OrderBookLevel[] = sortedBidPrices.map((price) => {
    const data = bidsMap.get(price)!;
    if (data.quantity > maxDepthQty) maxDepthQty = data.quantity;
    return {
      price,
      quantity: data.quantity,
      ordersCount: data.count,
      totalAmount: price * data.quantity,
    };
  });

  const asks: OrderBookLevel[] = sortedAskPrices.map((price) => {
    const data = asksMap.get(price)!;
    if (data.quantity > maxDepthQty) maxDepthQty = data.quantity;
    return {
      price,
      quantity: data.quantity,
      ordersCount: data.count,
      totalAmount: price * data.quantity,
    };
  });

  bids.forEach((b) => (b.depthPct = Math.min(100, Math.round((b.quantity / maxDepthQty) * 100))));
  asks.forEach((a) => (a.depthPct = Math.min(100, Math.round((a.quantity / maxDepthQty) * 100))));

  const bestBid = bids.length > 0 ? bids[0].price : null;
  const bestAsk = asks.length > 0 ? asks[0].price : null;
  const spread = bestAsk !== null && bestBid !== null ? Number((bestAsk - bestBid).toFixed(2)) : 0;
  const spreadPct = bestAsk && bestAsk > 0 ? Number(((spread / bestAsk) * 100).toFixed(2)) : 0;

  const openPrice = startup.openPrice || startup.initialPrice || 100;
  const priceChange = Number((startup.currentPrice - openPrice).toFixed(2));
  const percentageChange = Number((((startup.currentPrice - openPrice) / openPrice) * 100).toFixed(2));

  const response: OrderBookResponse = {
    startupId: startup.id,
    startupName: startup.name,
    currentPrice: startup.currentPrice,
    bestBid,
    bestAsk,
    spread,
    spreadPct,
    dayHigh: startup.dayHigh,
    dayLow: startup.dayLow,
    openPrice,
    totalVolume: startup.totalVolume,
    priceChange,
    percentageChange,
    bids,
    asks,
  };

  setCached(cacheKey, response, 1000);
  return response;
}

/**
 * Dynamic Automated Market Maker (AMM) Liquidity Engine.
 * Balanced, symmetric price ladder:
 * - Asks (Sell side) increase gently (+0.3%, +0.6%, +1.0%...)
 * - Bids (Buy side) decrease gently (-0.3%, -0.6%, -1.0%...)
 * - Equal volume depth and balance on both sides prevents unbalanced price spikes.
 */
export async function rebalanceMarketMakerLiquidity(
  startupId: string,
  targetLtp?: number,
  txClient?: any
) {
  const db = txClient || prisma;

  const startup = await db.startup.findUnique({
    where: { id: startupId },
    select: { id: true, currentPrice: true },
  });
  if (!startup) return;

  const basePrice = Number((targetLtp !== undefined ? targetLtp : startup.currentPrice || 100).toFixed(2));

  // Find system market maker account
  const systemAccount =
    (await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true, currentBalance: true } })) ||
    (await db.user.findFirst({ where: { role: "FII" }, select: { id: true, currentBalance: true } }));

  if (!systemAccount) return;

  // Ensure system account owns enough shares
  const mmHolding = await db.holding.findUnique({
    where: { userId_startupId: { userId: systemAccount.id, startupId } },
  });

  if (!mmHolding) {
    await db.holding.create({
      data: {
        userId: systemAccount.id,
        startupId,
        quantity: 10000000,
        averageBuyPrice: basePrice,
        totalInvested: 10000000 * basePrice,
      },
    });
  } else if (mmHolding.quantity < 500000) {
    await db.holding.update({
      where: { id: mmHolding.id },
      data: { quantity: mmHolding.quantity + 2000000 },
    });
  }

  // Ensure system account has liquid cash
  if (systemAccount.currentBalance < 100000000) {
    await db.user.update({
      where: { id: systemAccount.id },
      data: { currentBalance: 500000000 },
    });
  }

  // Clean up old MM orders by marking them CANCELLED (never delete to avoid foreign key violations with trades)
  await db.order.updateMany({
    where: {
      startupId,
      userId: systemAccount.id,
      status: { in: ["OPEN", "PARTIALLY_FILLED"] },
    },
    data: { status: "CANCELLED" },
  });

  const ordersToCreate: any[] = [];
  const seenAskPrices = new Set<number>();
  const seenBidPrices = new Set<number>();

  for (const tier of BALANCED_MM_TIERS) {
    const tick = basePrice < 1 ? 0.01 : 0.05;

    // Symmetrical Ask (Buy Side for customers)
    const askPrice = Number(Math.max(basePrice + tick, basePrice * (1 + tier.pct)).toFixed(2));
    if (!seenAskPrices.has(askPrice)) {
      seenAskPrices.add(askPrice);
      ordersToCreate.push({
        id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        userId: systemAccount.id,
        startupId,
        side: "SELL",
        type: "LIMIT",
        price: askPrice,
        quantity: tier.qty,
        filledQuantity: 0,
        remainingQuantity: tier.qty,
        status: "OPEN",
        reservedAmount: 0,
      });
    }

    // Symmetrical Bid (Sell Side for customers)
    const rawBid = Math.min(basePrice - tick, basePrice * (1 - tier.pct));
    const bidPrice = Number(Math.max(0.01, rawBid).toFixed(2));
    if (!seenBidPrices.has(bidPrice)) {
      seenBidPrices.add(bidPrice);
      ordersToCreate.push({
        id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        userId: systemAccount.id,
        startupId,
        side: "BUY",
        type: "LIMIT",
        price: bidPrice,
        quantity: tier.qty,
        filledQuantity: 0,
        remainingQuantity: tier.qty,
        status: "OPEN",
        reservedAmount: bidPrice * tier.qty,
      });
    }
  }

  if (ordersToCreate.length > 0) {
    await db.order.createMany({ data: ordersToCreate });
  }

  invalidateCache(`orderbook:${startupId}`);
}

/**
 * Helper to ensure healthy market making / initial liquidity for listed startups.
 */
export async function seedMarketLiquidityForStartup(startupId: string) {
  return await rebalanceMarketMakerLiquidity(startupId);
}

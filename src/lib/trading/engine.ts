import { prisma } from "@/lib/prisma";
import { formatINR, formatSharePrice } from "@/lib/formatters";
import { getUserDisplayIdentifier } from "@/lib/tokens";
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
}

/**
 * Executes a Buy or Sell Order atomically using a server-authoritative matching engine.
 */
export async function executeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { userId, startupId, side, type } = input;
  const quantity = Math.floor(input.quantity);

  if (!quantity || quantity <= 0) {
    throw new Error("Order quantity must be a positive integer.");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Check Global Circuit Breaker
    const marketState = await tx.marketState.findUnique({ where: { id: "global" } });
    if (!marketState || !marketState.isMarketActive) {
      throw new Error("The market is currently CLOSED or PAUSED by event administrators.");
    }

    // 2. Lock & Validate User
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.status === "BLOCKED") {
      throw new Error("User account is inactive or blocked.");
    }

    if (user.role !== "RETAIL" && user.role !== "FII" && user.role !== "ADMIN") {
      throw new Error("Only registered investors and judges are permitted to trade.");
    }

    // 3. Lock & Validate Startup / Stock
    const startup = await tx.startup.findUnique({ where: { id: startupId } });
    if (!startup) {
      throw new Error("Stock / team not found.");
    }

    if (startup.isSuspended) {
      throw new Error(`Trading in ${startup.name} is currently suspended by administrators.`);
    }

    if (startup.ipoStatus !== "IPO_OPEN") {
      throw new Error(`Trading in ${startup.name} is not open (status: ${startup.ipoStatus}).`);
    }

    // 4. Validate Price & Order Type
    let targetPrice = input.price ? Number(input.price) : startup.currentPrice;
    if (type === "LIMIT") {
      if (!input.price || input.price <= 0) {
        throw new Error("Limit orders require a valid positive price.");
      }
      targetPrice = Number(input.price);
    } else {
      // For market orders, targetPrice is reference price
      targetPrice = startup.currentPrice || 100;
    }

    // 5. Side-specific pre-trade validation & Escrow Locking
    let reservedAmount = 0;

    if (side === "BUY") {
      if (type === "LIMIT") {
        reservedAmount = quantity * targetPrice;
        if (user.currentBalance < reservedAmount) {
          throw new Error(
            `Insufficient cash balance. Required: ${formatINR(reservedAmount)}, Available: ${formatINR(user.currentBalance)}.`
          );
        }
        // Lock cash for limit buy
        await tx.user.update({
          where: { id: user.id },
          data: {
            currentBalance: { decrement: reservedAmount },
            lastActiveAt: new Date(),
          },
        });
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
      const userHolding = await tx.holding.findUnique({
        where: { userId_startupId: { userId: user.id, startupId: startup.id } },
      });

      const currentOwned = userHolding?.quantity || 0;

      // Count shares locked in existing open sell orders
      const openSellOrders = await tx.order.findMany({
        where: {
          userId: user.id,
          startupId: startup.id,
          side: "SELL",
          status: { in: ["OPEN", "PARTIALLY_FILLED"] },
        },
      });
      const lockedSellShares = openSellOrders.reduce((sum, ord) => sum + ord.remainingQuantity, 0);

      const availableToSell = currentOwned - lockedSellShares;
      if (availableToSell < quantity) {
        throw new Error(
          `Insufficient shares owned. You have ${availableToSell} shares available to sell, attempted to sell ${quantity}.`
        );
      }
    }

    // 6. Create the Order in Database
    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder = await tx.order.create({
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
    });

    // 7. Execute Order Matching Loop (Price-Time Priority)
    let remainingToFill = quantity;
    let totalExecutedAmount = 0;
    let totalExecutedQuantity = 0;
    const executedTrades: TradeResult[] = [];

    if (side === "BUY") {
      // Ensure liquidity exists before matching
      const existingSells = await tx.order.count({
        where: {
          startupId: startup.id,
          side: "SELL",
          status: { in: ["OPEN", "PARTIALLY_FILLED"] },
          userId: { not: user.id },
        },
      });

      if (existingSells === 0) {
        await rebalanceMarketMakerLiquidity(startup.id, startup.currentPrice, tx);
      }

      // Find opposite SELL orders: sorted by price ASC (cheapest first), then createdAt ASC
      const matchingSellOrders = await tx.order.findMany({
        where: {
          startupId: startup.id,
          side: "SELL",
          status: { in: ["OPEN", "PARTIALLY_FILLED"] },
          userId: { not: user.id }, // Self-trade prevention
          ...(type === "LIMIT" ? { price: { lte: targetPrice } } : {}),
        },
        orderBy: [{ price: "asc" }, { createdAt: "asc" }],
      });

      for (const sellOrder of matchingSellOrders) {
        if (remainingToFill <= 0) break;

        const tradeQty = Math.min(remainingToFill, sellOrder.remainingQuantity);
        const tradePrice = sellOrder.price; // Trade executes at maker's ask price
        const tradeAmount = tradeQty * tradePrice;

        // Check if market buyer can afford this fill
        if (type === "MARKET") {
          const freshUser = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
          if (freshUser.currentBalance < tradeAmount) {
            // Can't afford full trade, see if can afford partial
            const maxAffordableQty = Math.floor(freshUser.currentBalance / tradePrice);
            if (maxAffordableQty <= 0) break;
            // Cap tradeQty to maxAffordableQty
            if (maxAffordableQty < tradeQty) {
              // break or adjust
              break;
            }
          }
        }

        // Generate unique Trade ID
        const tradeId = `TRD-${Math.floor(100000 + Math.random() * 900000)}`;
        await tx.trade.create({
          data: {
            id: tradeId,
            startupId: startup.id,
            buyOrderId: newOrder.id,
            sellOrderId: sellOrder.id,
            buyerId: user.id,
            sellerId: sellOrder.userId,
            price: tradePrice,
            quantity: tradeQty,
            amount: tradeAmount,
          },
        });

        // Transfer Shares to Buyer's Holding & recalculate average buy price
        const buyerHolding = await tx.holding.findUnique({
          where: { userId_startupId: { userId: user.id, startupId: startup.id } },
        });

        if (buyerHolding) {
          const newQty = buyerHolding.quantity + tradeQty;
          const newInvested = buyerHolding.totalInvested + tradeAmount;
          const newAvgBuyPrice = newQty > 0 ? newInvested / newQty : tradePrice;

          await tx.holding.update({
            where: { id: buyerHolding.id },
            data: {
              quantity: newQty,
              totalInvested: newInvested,
              averageBuyPrice: newAvgBuyPrice,
            },
          });
        } else {
          await tx.holding.create({
            data: {
              userId: user.id,
              startupId: startup.id,
              quantity: tradeQty,
              averageBuyPrice: tradePrice,
              totalInvested: tradeAmount,
            },
          });
        }

        // Transfer Shares from Seller's Holding & calculate Realized P&L
        const sellerHolding = await tx.holding.findUnique({
          where: { userId_startupId: { userId: sellOrder.userId, startupId: startup.id } },
        });

        if (sellerHolding) {
          const costBasisOfSoldShares = tradeQty * sellerHolding.averageBuyPrice;
          const realizedPnLDelta = tradeAmount - costBasisOfSoldShares;
          const newSellerQty = Math.max(0, sellerHolding.quantity - tradeQty);
          const newSellerInvested = newSellerQty * sellerHolding.averageBuyPrice;

          await tx.holding.update({
            where: { id: sellerHolding.id },
            data: {
              quantity: newSellerQty,
              totalInvested: newSellerInvested,
              realizedPnL: { increment: realizedPnLDelta },
            },
          });
        }

        // Cash Movement:
        // Seller receives tradeAmount
        await tx.user.update({
          where: { id: sellOrder.userId },
          data: {
            currentBalance: { increment: tradeAmount },
            lastActiveAt: new Date(),
          },
        });

        // Buyer pays tradeAmount:
        if (type === "LIMIT") {
          // Cash was already escrowed at targetPrice. If tradePrice < targetPrice, refund the improvement!
          const escrowedForThisQty = tradeQty * targetPrice;
          const priceImprovementRefund = escrowedForThisQty - tradeAmount;
          if (priceImprovementRefund > 0) {
            await tx.user.update({
              where: { id: user.id },
              data: {
                currentBalance: { increment: priceImprovementRefund },
                totalInvested: { increment: tradeAmount },
              },
            });
          } else {
            await tx.user.update({
              where: { id: user.id },
              data: { totalInvested: { increment: tradeAmount } },
            });
          }
        } else {
          // Market Buy: deduct cash now
          await tx.user.update({
            where: { id: user.id },
            data: {
              currentBalance: { decrement: tradeAmount },
              totalInvested: { increment: tradeAmount },
              lastActiveAt: new Date(),
            },
          });
        }

        // Update Sell Order fill status
        const updatedSellFilled = sellOrder.filledQuantity + tradeQty;
        const updatedSellRemaining = sellOrder.remainingQuantity - tradeQty;
        await tx.order.update({
          where: { id: sellOrder.id },
          data: {
            filledQuantity: updatedSellFilled,
            remainingQuantity: updatedSellRemaining,
            status: updatedSellRemaining === 0 ? "FILLED" : "PARTIALLY_FILLED",
          },
        });

        // Log trade in PriceHistory
        await tx.priceHistory.create({
          data: {
            startupId: startup.id,
            price: tradePrice,
            volume: tradeQty,
          },
        });

        // Create legacy Investment record for backwards compatibility and audit consistency
        const userDisplayId = getUserDisplayIdentifier(user);
        await tx.investment.create({
          data: {
            id: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
            investorId: user.id,
            investorName: userDisplayId,
            investorType: user.role === "FII" ? "FII" : "RETAIL",
            startupId: startup.id,
            amount: tradeAmount,
            status: "VALID",
            note: `Market Trade ${tradeId} (${tradeQty} shares @ ${formatSharePrice(tradePrice)})`,
          },
        });

        // Broadcast to ActivityFeed
        await tx.activityFeed.create({
          data: {
            type: "TRADE",
            message: `${userDisplayId} bought ${tradeQty} shares of ${startup.name} at ${formatSharePrice(tradePrice)}`,
            startupName: startup.name,
            investorName: userDisplayId,
            amount: tradeAmount,
            isPublic: true,
          },
        });

        executedTrades.push({
          tradeId,
          price: tradePrice,
          quantity: tradeQty,
          amount: tradeAmount,
          buyerId: user.id,
          sellerId: sellOrder.userId,
        });

        remainingToFill -= tradeQty;
        totalExecutedQuantity += tradeQty;
        totalExecutedAmount += tradeAmount;
      }
    } else {
      // Ensure liquidity exists before matching
      const existingBuys = await tx.order.count({
        where: {
          startupId: startup.id,
          side: "BUY",
          status: { in: ["OPEN", "PARTIALLY_FILLED"] },
          userId: { not: user.id },
        },
      });

      if (existingBuys === 0) {
        await rebalanceMarketMakerLiquidity(startup.id, startup.currentPrice, tx);
      }

      // SELL matching: Find opposite BUY orders: sorted by price DESC (highest bid first), then createdAt ASC
      const matchingBuyOrders = await tx.order.findMany({
        where: {
          startupId: startup.id,
          side: "BUY",
          status: { in: ["OPEN", "PARTIALLY_FILLED"] },
          userId: { not: user.id }, // Self-trade prevention
          ...(type === "LIMIT" ? { price: { gte: targetPrice } } : {}),
        },
        orderBy: [{ price: "desc" }, { createdAt: "asc" }],
      });

      for (const buyOrder of matchingBuyOrders) {
        if (remainingToFill <= 0) break;

        const tradeQty = Math.min(remainingToFill, buyOrder.remainingQuantity);
        let tradePrice = buyOrder.price; // Trade executes at maker's bid price

        // On selling shares, limit price drop to only 0.2% per user specification
        if (side === "SELL") {
          const maxDropPrice = Number((startup.currentPrice * 0.998).toFixed(2));
          tradePrice = Math.max(tradePrice, maxDropPrice);
        }

        const tradeAmount = tradeQty * tradePrice;

        const tradeId = `TRD-${Math.floor(100000 + Math.random() * 900000)}`;
        await tx.trade.create({
          data: {
            id: tradeId,
            startupId: startup.id,
            buyOrderId: buyOrder.id,
            sellOrderId: newOrder.id,
            buyerId: buyOrder.userId,
            sellerId: user.id,
            price: tradePrice,
            quantity: tradeQty,
            amount: tradeAmount,
          },
        });

        // Transfer Shares to Buyer's Holding
        const buyerHolding = await tx.holding.findUnique({
          where: { userId_startupId: { userId: buyOrder.userId, startupId: startup.id } },
        });

        if (buyerHolding) {
          const newQty = buyerHolding.quantity + tradeQty;
          const newInvested = buyerHolding.totalInvested + tradeAmount;
          const newAvg = newQty > 0 ? newInvested / newQty : tradePrice;
          await tx.holding.update({
            where: { id: buyerHolding.id },
            data: {
              quantity: newQty,
              totalInvested: newInvested,
              averageBuyPrice: newAvg,
            },
          });
        } else {
          await tx.holding.create({
            data: {
              userId: buyOrder.userId,
              startupId: startup.id,
              quantity: tradeQty,
              averageBuyPrice: tradePrice,
              totalInvested: tradeAmount,
            },
          });
        }

        // Deduct Shares from Seller's Holding & update Realized P&L
        const sellerHolding = await tx.holding.findUnique({
          where: { userId_startupId: { userId: user.id, startupId: startup.id } },
        });

        if (sellerHolding) {
          const costBasisOfSoldShares = tradeQty * sellerHolding.averageBuyPrice;
          const realizedPnLDelta = tradeAmount - costBasisOfSoldShares;
          const newSellerQty = Math.max(0, sellerHolding.quantity - tradeQty);
          const newSellerInvested = newSellerQty * sellerHolding.averageBuyPrice;

          await tx.holding.update({
            where: { id: sellerHolding.id },
            data: {
              quantity: newSellerQty,
              totalInvested: newSellerInvested,
              realizedPnL: { increment: realizedPnLDelta },
            },
          });
        }

        // Cash: Seller receives tradeAmount
        await tx.user.update({
          where: { id: user.id },
          data: {
            currentBalance: { increment: tradeAmount },
            lastActiveAt: new Date(),
          },
        });

        // Buyer already had funds locked in reservedAmount when placing Buy Limit.
        // Update buyer's totalInvested:
        await tx.user.update({
          where: { id: buyOrder.userId },
          data: {
            totalInvested: { increment: tradeAmount },
          },
        });

        // Update Buy Order status
        const updatedBuyFilled = buyOrder.filledQuantity + tradeQty;
        const updatedBuyRemaining = buyOrder.remainingQuantity - tradeQty;
        await tx.order.update({
          where: { id: buyOrder.id },
          data: {
            filledQuantity: updatedBuyFilled,
            remainingQuantity: updatedBuyRemaining,
            status: updatedBuyRemaining === 0 ? "FILLED" : "PARTIALLY_FILLED",
          },
        });

        // Log trade in PriceHistory
        await tx.priceHistory.create({
          data: {
            startupId: startup.id,
            price: tradePrice,
            volume: tradeQty,
          },
        });

        // ActivityFeed
        const buyerUser = await tx.user.findUnique({ where: { id: buyOrder.userId } });
        const sellerDisplayId = getUserDisplayIdentifier(user);
        const buyerDisplayId = buyerUser ? getUserDisplayIdentifier(buyerUser) : "Buyer";
        await tx.activityFeed.create({
          data: {
            type: "TRADE",
            message: `${sellerDisplayId} sold ${tradeQty} shares of ${startup.name} to ${buyerDisplayId} at ${formatSharePrice(tradePrice)}`,
            startupName: startup.name,
            investorName: sellerDisplayId,
            amount: tradeAmount,
            isPublic: true,
          },
        });

        executedTrades.push({
          tradeId,
          price: tradePrice,
          quantity: tradeQty,
          amount: tradeAmount,
          buyerId: buyOrder.userId,
          sellerId: user.id,
        });

        remainingToFill -= tradeQty;
        totalExecutedQuantity += tradeQty;
        totalExecutedAmount += tradeAmount;
      }
    }

    // 8. Update Incoming Order's Final State
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

    // If a MARKET order has unfilled quantity, we cancel the remainder since there is no matching liquidity
    if (type === "MARKET" && finalRemaining > 0) {
      finalStatus = finalFilled > 0 ? "PARTIALLY_FILLED" : "REJECTED";
    }

    await tx.order.update({
      where: { id: newOrder.id },
      data: {
        filledQuantity: finalFilled,
        remainingQuantity: type === "MARKET" ? 0 : finalRemaining,
        status: finalStatus,
      },
    });

    // 9. Update Startup Stock Statistics if trades occurred
    if (executedTrades.length > 0) {
      const lastTrade = executedTrades[executedTrades.length - 1];
      let newLtp: number;
      if (side === "SELL") {
        // On selling shares, price goes down only 0.2% per user specification
        newLtp = Number(Math.max(0.01, startup.currentPrice * 0.998).toFixed(2));
      } else {
        newLtp = lastTrade.price;
      }
      const newHigh = Math.max(startup.dayHigh || newLtp, newLtp);
      const newLow = startup.dayLow && startup.dayLow > 0 ? Math.min(startup.dayLow, newLtp) : newLtp;
      const openPrice = startup.openPrice || startup.initialPrice || 100;
      const priceChange = Number((newLtp - openPrice).toFixed(2));
      const percentageChange = Number((((newLtp - openPrice) / openPrice) * 100).toFixed(2));

      await tx.startup.update({
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
      });

      // Re-center dynamic market maker liquidity around the new LTP so bids and asks shift together
      await rebalanceMarketMakerLiquidity(startup.id, newLtp, tx);
    }

    // 10. Fetch fresh balance
    const updatedUser = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    const avgPrice = totalExecutedQuantity > 0 ? totalExecutedAmount / totalExecutedQuantity : targetPrice;

    return {
      success: true,
      orderId: newOrder.id,
      status: finalStatus,
      filledQuantity: finalFilled,
      remainingQuantity: finalRemaining,
      averageExecutionPrice: avgPrice,
      totalExecutedAmount,
      trades: executedTrades,
      message:
        finalFilled === quantity
          ? `Order completely filled! Bought/Sold ${finalFilled} shares at average price ${formatSharePrice(avgPrice)}.`
          : finalFilled > 0
          ? `Partially filled: ${finalFilled} of ${quantity} shares at ${formatSharePrice(avgPrice)}.`
          : `Order placed into order book at ${formatSharePrice(targetPrice)}. Awaiting matching.`,
      newBalance: updatedUser.currentBalance,
    };
  }, {
    maxWait: 10000,
    timeout: 30000,
  });
}

/**
 * Cancels an open or partially filled order and unfreezes reserved cash or shares.
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

    return {
      success: true,
      message: `Order ${order.id} cancelled successfully.`,
    };
  }, {
    maxWait: 10000,
    timeout: 20000,
  });
}

/**
 * Returns aggregated Order Book depth (Bids & Asks) for a startup.
 */
export async function getOrderBook(startupId: string): Promise<OrderBookResponse> {
  const startup = await prisma.startup.findUniqueOrThrow({
    where: { id: startupId },
  });

  let openOrders = await prisma.order.findMany({
    where: {
      startupId,
      status: { in: ["OPEN", "PARTIALLY_FILLED"] },
      remainingQuantity: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
  });

  if (openOrders.length === 0) {
    await rebalanceMarketMakerLiquidity(startupId);
    openOrders = await prisma.order.findMany({
      where: {
        startupId,
        status: { in: ["OPEN", "PARTIALLY_FILLED"] },
        remainingQuantity: { gt: 0 },
      },
      orderBy: { createdAt: "asc" },
    });
  }

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

  // Attach depth bars
  bids.forEach((b) => (b.depthPct = Math.min(100, Math.round((b.quantity / maxDepthQty) * 100))));
  asks.forEach((a) => (a.depthPct = Math.min(100, Math.round((a.quantity / maxDepthQty) * 100))));

  const bestBid = bids.length > 0 ? bids[0].price : null;
  const bestAsk = asks.length > 0 ? asks[0].price : null;
  const spread = bestAsk !== null && bestBid !== null ? Number((bestAsk - bestBid).toFixed(2)) : 0;
  const spreadPct = bestAsk && bestAsk > 0 ? Number(((spread / bestAsk) * 100).toFixed(2)) : 0;

  const openPrice = startup.openPrice || startup.initialPrice || 100;
  const priceChange = Number((startup.currentPrice - openPrice).toFixed(2));
  const percentageChange = Number((((startup.currentPrice - openPrice) / openPrice) * 100).toFixed(2));

  return {
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
}

/**
 * Dynamic Automated Market Maker (AMM) Liquidity Engine.
 * Highly sensitive, wide-range pricing model:
 * - Ultra-sensitive price discovery: orders of even modest sizes rapidly tick through price levels.
 * - Boundless upside: Multi-tier exponential ask ladder reaching up to +12,000% (120x) with no artificial ceilings.
 * - Extreme downside: Deep bid tiers plunging down to penny levels (-99.9%, down to ₹0.01).
 * - Full server-side rebalancing continuously re-centers liquidity around the newest LTP, compounding price action in both directions.
 */
export async function rebalanceMarketMakerLiquidity(
  startupId: string,
  targetLtp?: number,
  txClient?: any
) {
  const db = txClient || prisma;

  const startup = await db.startup.findUnique({ where: { id: startupId } });
  if (!startup) return;

  const basePrice = Number((targetLtp !== undefined ? targetLtp : startup.currentPrice || 100).toFixed(2));

  // Find designated market maker system account (ADMIN)
  const systemAccount =
    (await db.user.findFirst({ where: { role: "ADMIN" } })) ||
    (await db.user.findFirst({ where: { role: "FII" } }));

  if (!systemAccount) return;

  // Ensure system account owns enough shares to back deep ask depth
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

  // Ensure system account has ample liquid cash to absorb heavy retail and institutional sells
  if (systemAccount.currentBalance < 100000000) {
    await db.user.update({
      where: { id: systemAccount.id },
      data: { currentBalance: 500000000 },
    });
  }

  // Clean up existing market maker orders for this startup (only system MM orders)
  await db.order.deleteMany({
    where: {
      startupId,
      userId: systemAccount.id,
      filledQuantity: 0,
      status: "OPEN",
    },
  });

  await db.order.updateMany({
    where: {
      startupId,
      userId: systemAccount.id,
      filledQuantity: { gt: 0 },
      status: { in: ["OPEN", "PARTIALLY_FILLED"] },
    },
    data: {
      status: "CANCELLED",
      remainingQuantity: 0,
    },
  });

  // Highly sensitive, exponential ask quotes (Sell side)
  // Low initial quantities mean small buys immediately spike the price,
  // while extended tiers allow the price to skyrocket to 100x+ without any artificial ceiling.
  const askOffsets = [
    { pct: 0.025, qty: 20 },     // +2.5% (20 shares)
    { pct: 0.060, qty: 30 },     // +6.0% (30 shares)
    { pct: 0.120, qty: 50 },     // +12.0% (50 shares)
    { pct: 0.220, qty: 75 },     // +22.0% (75 shares)
    { pct: 0.380, qty: 100 },    // +38.0% (100 shares)
    { pct: 0.600, qty: 150 },    // +60.0% (150 shares)
    { pct: 0.950, qty: 250 },    // +95.0% (250 shares)
    { pct: 1.500, qty: 400 },    // +150.0% (400 shares)
    { pct: 2.400, qty: 650 },    // +240.0% (650 shares)
    { pct: 3.800, qty: 1000 },   // +380.0% (1,000 shares)
    { pct: 6.000, qty: 1800 },   // +600.0% (1,800 shares)
    { pct: 10.000, qty: 3000 },  // +1,000.0% (3,000 shares)
    { pct: 18.000, qty: 5000 },  // +1,800.0% (5,000 shares)
    { pct: 30.000, qty: 10000 }, // +3,000.0% (10,000 shares)
    { pct: 60.000, qty: 20000 }, // +6,000.0% (20,000 shares)
    { pct: 120.000, qty: 50000 },// +12,000.0% (50,000 shares)
  ];

  // Stable, low-slippage bid quotes (Buy side - absorbs sells)
  // Low impact: selling shares drops price by only ~0.2%, backed by heavy institutional liquidity
  const bidOffsets = [
    { pct: 0.002, qty: 50000 },   // -0.2% (50,000 shares) -> Absorbs all-at-once selling with only 0.2% drop
    { pct: 0.004, qty: 100000 },  // -0.4% (100,000 shares)
    { pct: 0.006, qty: 150000 },  // -0.6% (150,000 shares)
    { pct: 0.008, qty: 200000 },  // -0.8% (200,000 shares)
    { pct: 0.010, qty: 300000 },  // -1.0% (300,000 shares)
    { pct: 0.015, qty: 500000 },  // -1.5% (500,000 shares)
    { pct: 0.020, qty: 1000000 }, // -2.0% (1,000,000 shares)
  ];

  const ordersToCreate: any[] = [];

  const seenAskPrices = new Set<number>();
  for (const item of askOffsets) {
    const tick = basePrice < 1 ? 0.01 : 0.05;
    const askPrice = Number(Math.max(basePrice + tick, basePrice * (1 + item.pct)).toFixed(2));
    if (seenAskPrices.has(askPrice)) continue;
    seenAskPrices.add(askPrice);

    ordersToCreate.push({
      id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: systemAccount.id,
      startupId,
      side: "SELL",
      type: "LIMIT",
      price: askPrice,
      quantity: item.qty,
      filledQuantity: 0,
      remainingQuantity: item.qty,
      status: "OPEN",
      reservedAmount: 0,
    });
  }

  const seenBidPrices = new Set<number>();
  for (const item of bidOffsets) {
    const tick = basePrice < 1 ? 0.01 : 0.05;
    const rawBid = Math.min(basePrice - tick, basePrice * (1 - item.pct));
    const bidPrice = Number(Math.max(0.01, rawBid).toFixed(2));
    if (seenBidPrices.has(bidPrice)) continue;
    seenBidPrices.add(bidPrice);

    ordersToCreate.push({
      id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: systemAccount.id,
      startupId,
      side: "BUY",
      type: "LIMIT",
      price: bidPrice,
      quantity: item.qty,
      filledQuantity: 0,
      remainingQuantity: item.qty,
      status: "OPEN",
      reservedAmount: bidPrice * item.qty,
    });
  }

  if (ordersToCreate.length > 0) {
    await db.order.createMany({ data: ordersToCreate });
  }

  // Seed baseline PriceHistory points if none exist
  const historyCount = await db.priceHistory.count({ where: { startupId } });
  if (historyCount === 0) {
    await db.priceHistory.createMany({
      data: [
        {
          id: `PH-${Math.floor(100000 + Math.random() * 900000)}`,
          startupId,
          price: basePrice,
          volume: 100,
          timestamp: new Date(Date.now() - 3600000),
        },
        {
          id: `PH-${Math.floor(100000 + Math.random() * 900000)}`,
          startupId,
          price: basePrice,
          volume: 150,
          timestamp: new Date(),
        },
      ],
    });
  }
}

/**
 * Helper to ensure healthy market making / initial liquidity for listed startups.
 */
export async function seedMarketLiquidityForStartup(startupId: string) {
  return await rebalanceMarketMakerLiquidity(startupId);
}


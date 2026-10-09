export type UserRole = "ADMIN" | "FII" | "RETAIL" | "STARTUP";
export type UserStatus = "ACTIVE" | "BLOCKED";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  token?: string | null;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  startingCapital: number;
  currentBalance: number;
  totalInvested: number;
  isOnline: boolean;
  lastActiveAt: string | Date;
  startupId?: string | null;
  startupSlug?: string | null;
  startupName?: string | null;
  activeSessionId?: string | null;
  holdings?: {
    startupId: string;
    quantity: number;
    averageBuyPrice: number;
    totalInvested: number;
    realizedPnL: number;
  }[];
}

export type IPOStatus =
  | "COMING_UP"
  | "PITCHING"
  | "QA"
  | "IPO_OPEN"
  | "IPO_PAUSED"
  | "IPO_CLOSED"
  | "UNDER_REVIEW"
  | "FINALIZED"
  | "DISQUALIFIED";

export interface TeamMember {
  name: string;
  role: string;
  avatar: string;
  bio: string;
}

export interface StartupItem {
  id: string;
  name: string;
  slug: string;
  token?: string | null;
  logoUrl?: string | null;
  tagLine: string;
  industry: string;
  problem: string;
  solution: string;
  businessModel: string;
  targetMarket: string;
  fundingAsk: number;
  equityOffered?: number | null;
  pitchSummary: string;
  pitchDeckUrl?: string | null;
  teamMembers: string; // JSON parsed on client
  pitchOrder: number;
  ipoStatus: IPOStatus;
  totalInvestmentReceived: number;
  retailInvestment: number;
  fiiInvestment: number;
  investorCount: number;

  // Stock trading fields
  initialPrice?: number;
  currentPrice: number;
  previousPrice: number;
  openPrice: number;
  dayHigh: number;
  dayLow: number;
  totalShares: number;
  availableShares?: number;
  initialValuation: number;
  totalVolume: number;
  isSuspended: boolean;
  marketCap?: number;
  priceChange?: number;
  percentageChange?: number;
  investments?: InvestmentItem[];
}

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT";
export type OrderStatus = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "REJECTED";

export interface OrderItem {
  id: string;
  userId: string;
  userName?: string;
  startupId: string;
  startupName?: string;
  startupSlug?: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  reservedAmount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface TradeItem {
  id: string;
  startupId: string;
  startupName?: string;
  startupSlug?: string;
  buyOrderId?: string | null;
  sellOrderId?: string | null;
  buyerId: string;
  buyerName?: string;
  sellerId: string;
  sellerName?: string;
  price: number;
  quantity: number;
  amount: number;
  createdAt: string | Date;
}

export interface PriceHistoryPoint {
  id?: string;
  price: number;
  volume: number;
  timestamp: string | Date;
  timeLabel?: string;
}

export interface HoldingItem {
  id?: string;
  startupId: string;
  startupName: string;
  slug: string;
  logoUrl?: string | null;
  industry?: string;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedReturnPct: number;
  realizedPnL: number;
  totalPnL: number;
  allocationPercent: number;
  transactionCount?: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  ordersCount: number;
  totalAmount: number;
  depthPct?: number;
}

export interface OrderBookResponse {
  startupId: string;
  startupName: string;
  currentPrice: number;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number;
  spreadPct: number;
  dayHigh: number;
  dayLow: number;
  openPrice: number;
  totalVolume: number;
  priceChange: number;
  percentageChange: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface PortfolioResponse {
  user: SafeUser;
  summary: {
    totalPortfolioValue: number;
    availableCash: number;
    investedValue: number;
    currentValue: number;
    unrealizedPnL: number;
    realizedPnL: number;
    totalPnL: number;
    totalReturnPct: number;
    holdingsCount: number;
  };
  holdings: HoldingItem[];
  openOrders: OrderItem[];
  recentOrders: OrderItem[];
  recentTrades: TradeItem[];
  totalHoldingsCount: number;
  recentTransactions: InvestmentItem[];
}

export interface InvestmentItem {
  id: string;
  investorId: string;
  investorName: string;
  investorType: "RETAIL" | "FII";
  startupId: string;
  startupName?: string;
  amount: number;
  status: "VALID" | "CANCELLED" | "REVERSED" | "UNDER_REVIEW";
  note?: string | null;
  createdAt: string | Date;
}

export interface MarketStateItem {
  id: string;
  isMarketActive: boolean;
  activeStartupId?: string | null;
  hideInvestorNamesPublicly: boolean;
  bannerMessage?: string | null;
}

export interface ActivityFeedItem {
  id: string;
  type: string;
  message: string;
  startupName?: string | null;
  investorName?: string | null;
  amount?: number | null;
  isPublic: boolean;
  createdAt: string | Date;
}

export interface FinalAwardItem {
  id: string;
  awardKey: string;
  awardName: string;
  startupId?: string | null;
  startupName?: string | null;
  metric?: string | null;
  isPublic: boolean;
  confirmedByAdmin: boolean;
}

export interface AuditLogItem {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string;
  previousValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  createdAt: string | Date;
}

export interface WatchlistItem {
  startupId: string;
  name: string;
  slug: string;
  currentPrice: number;
  priceChange: number;
  percentageChange: number;
  industry: string;
}

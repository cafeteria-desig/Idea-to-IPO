export function formatINR(amount: number, compact = true): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "₹0";
  const sign = amount < 0 ? "-" : "";
  const absAmount = Math.abs(amount);

  if (compact) {
    if (absAmount >= 10000000) {
      return `${sign}₹${(absAmount / 10000000).toFixed(2)} Cr`;
    }
    if (absAmount >= 100000) {
      return `${sign}₹${(absAmount / 100000).toFixed(2)} L`;
    }
    if (absAmount >= 1000) {
      return `${sign}₹${(absAmount / 1000).toFixed(1)}k`;
    }
    return `${sign}₹${Math.round(absAmount)}`;
  }

  // Full Indian number formatting (e.g. 1,00,00,000)
  const integerPart = Math.round(absAmount).toString();
  const lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  const formattedOther =
    otherNumbers !== ""
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + ","
      : "";
  return `${sign}₹${formattedOther}${lastThree}`;
}

export function formatSharePrice(price: number): string {
  if (price === undefined || price === null || isNaN(price)) return "₹0.00";
  const absPrice = Math.abs(price);
  return `${price < 0 ? "-" : ""}₹${absPrice.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPriceChange(
  change: number,
  pct: number
): {
  text: string;
  isPositive: boolean;
  isNeutral: boolean;
  badgeClass: string;
  textClass: string;
} {
  const isNeutral = Math.abs(change) < 0.001;
  const isPositive = change > 0;
  const sign = isPositive ? "+" : isNeutral ? "" : "-";
  const absChange = Math.abs(change).toFixed(2);
  const absPct = Math.abs(pct).toFixed(2);

  const text = `${sign}₹${absChange} (${sign}${absPct}%)`;

  let badgeClass = "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  let textClass = "text-zinc-400";

  if (isPositive) {
    badgeClass = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    textClass = "text-emerald-400";
  } else if (!isNeutral) {
    badgeClass = "bg-rose-500/15 text-rose-400 border-rose-500/30";
    textClass = "text-rose-400";
  }

  return { text, isPositive, isNeutral, badgeClass, textClass };
}

export function calculatePnL(
  quantity: number,
  averageBuyPrice: number,
  currentPrice: number
): {
  investedValue: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedReturnPct: number;
} {
  const investedValue = quantity * averageBuyPrice;
  const currentValue = quantity * currentPrice;
  const unrealizedPnL = currentValue - investedValue;
  const unrealizedReturnPct =
    investedValue > 0 ? (unrealizedPnL / investedValue) * 100 : 0;

  return {
    investedValue,
    currentValue,
    unrealizedPnL,
    unrealizedReturnPct,
  };
}

export function getSubscriptionStatus(
  received: number,
  ask: number
): {
  ratio: number;
  status: "UNDERSUBSCRIBED" | "FULLY_SUBSCRIBED" | "OVERSUBSCRIBED";
  label: string;
  badgeClass: string;
} {
  if (!ask || ask <= 0) {
    return {
      ratio: 0,
      status: "UNDERSUBSCRIBED",
      label: "0.00x Subscribed",
      badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    };
  }

  const ratio = received / ask;

  if (ratio < 0.95) {
    return {
      ratio,
      status: "UNDERSUBSCRIBED",
      label: `${ratio.toFixed(2)}x Subscribed`,
      badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    };
  }

  if (ratio <= 1.05) {
    return {
      ratio,
      status: "FULLY_SUBSCRIBED",
      label: `${ratio.toFixed(2)}x Subscribed`,
      badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    };
  }

  return {
    ratio,
    status: "OVERSUBSCRIBED",
    label: `${ratio.toFixed(2)}x Subscribed`,
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
}

export function formatDate(date: string | Date | number): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

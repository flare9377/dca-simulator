import type { Currency, TransactionType } from "@prisma/client";

export type Money = {
  amount: number;
  currency: Currency;
};

export type TransactionLike = {
  transactionType: TransactionType;
  date: Date;
  price: number;
  quantity: number;
  fee: number;
  currency: Currency;
};

export type AssetPosition = {
  invested: number;
  quantity: number;
  avgPrice: number | null;
};

export type AssetPerformance = AssetPosition & {
  currentPrice: number | null;
  value: number;
  pnl: number;
  returnRatePct: number | null;
};

/**
 * Cost basis: moving average (가중평균 단가).
 *
 * - buy: invested += price*qty + fee, quantity += qty
 * - sell: invested -= avgPrice*qtySold (proportional cost basis reduction), quantity -= qtySold
 *
 * MVP에서는 매수만 입력해도 정상 동작하고,
 * 향후 매도 거래가 추가되어도 평균단가가 왜곡되지 않도록 이동평균법을 기본으로 채택.
 */
export function computePosition(
  transactions: TransactionLike[],
  currency: Currency,
): AssetPosition {
  const sorted = [...transactions]
    .filter((t) => t.currency === currency)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let invested = 0;
  let quantity = 0;

  for (const t of sorted) {
    if (t.quantity <= 0) continue;

    const gross = t.price * t.quantity + (t.fee ?? 0);

    if (t.transactionType === "buy") {
      invested += gross;
      quantity += t.quantity;
      continue;
    }

    if (t.transactionType === "sell") {
      if (quantity <= 0) {
        // No position: ignore (or could treat as short, but out-of-scope).
        continue;
      }
      const qtySold = Math.min(t.quantity, quantity);
      const avgPrice = invested / quantity;
      invested -= avgPrice * qtySold;
      quantity -= qtySold;
      // fees on sell are ignored for unrealized PnL basis in MVP;
      // realized pnl handling will be added later.
    }
  }

  const avgPrice = quantity > 0 ? invested / quantity : null;
  return { invested, quantity, avgPrice };
}

export function computePerformance(args: {
  transactions: TransactionLike[];
  currency: Currency;
  currentPrice: number | null;
}): AssetPerformance {
  const pos = computePosition(args.transactions, args.currency);
  const value = args.currentPrice != null ? args.currentPrice * pos.quantity : 0;
  const pnl = value - pos.invested;
  const returnRatePct =
    pos.invested > 0 ? (pnl / pos.invested) * 100 : null;

  return {
    ...pos,
    currentPrice: args.currentPrice,
    value,
    pnl,
    returnRatePct,
  };
}

export function computePortfolioSummary(items: AssetPerformance[]) {
  const totalInvested = items.reduce((s, x) => s + x.invested, 0);
  const totalValue = items.reduce((s, x) => s + x.value, 0);
  const totalPnl = totalValue - totalInvested;
  const totalReturnRatePct =
    totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null;

  const weights = totalValue > 0
    ? items.map((x) => ({
        value: x.value,
        weightPct: (x.value / totalValue) * 100,
      }))
    : items.map((x) => ({ value: x.value, weightPct: 0 }));

  return {
    totalInvested,
    totalValue,
    totalPnl,
    totalReturnRatePct,
    weights,
  };
}


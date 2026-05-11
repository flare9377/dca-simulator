import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { chainProviders } from "@/lib/prices/providers/chain";
import { createCoinGeckoProvider } from "@/lib/prices/providers/coingecko";
import { createManualProvider } from "@/lib/prices/providers/manual";
import { computePerformance } from "@/lib/portfolio/calc";
import type { HistoricalPrice } from "@/lib/prices/types";

function decToNumber(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function findHistoricalPriceAtOrBefore(
  prices: HistoricalPrice[],
  date: Date,
): HistoricalPrice | null {
  const target = date.getTime();
  let best: HistoricalPrice | null = null;

  for (const price of prices) {
    if (price.asOf.getTime() > target) break;
    best = price;
  }

  return best;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await ctx.params;
  const upper = symbol.toUpperCase();

  const asset = await prisma.asset.findUnique({
    where: { symbol: upper },
    include: {
      transactions: { orderBy: { date: "asc" } },
      priceSnapshots: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const manual = createManualProvider({
    async getLastKnown({ symbol: s, currency }) {
      const snap = asset.priceSnapshots?.[0];
      if (!snap || s !== upper || snap.currency !== currency) return null;
      return { price: decToNumber(snap.price), asOf: snap.timestamp };
    },
  });

  const coingecko = createCoinGeckoProvider();
  const provider = chainProviders([coingecko, manual]);

  let quote: { price: number; source: string; asOf: Date } | null = null;
  try {
    const q = await provider.getQuote({ symbol: upper, currency: asset.currency });
    quote = { price: q.price, source: q.source, asOf: q.asOf };
    if (q.source === "coingecko" && q.price > 0) {
      await prisma.priceSnapshot.create({
        data: {
          assetId: asset.id,
          price: String(q.price),
          currency: q.currency,
          source: q.source,
          timestamp: q.asOf,
        },
      });
    }
  } catch {
    // ignore
  }

  const tx = asset.transactions.map((t) => ({
    id: t.id,
    transactionType: t.transactionType,
    date: t.date,
    price: decToNumber(t.price),
    quantity: decToNumber(t.quantity),
    fee: decToNumber(t.fee),
    currency: t.currency,
    memo: t.memo ?? null,
  }));

  const performance = computePerformance({
    transactions: tx,
    currency: asset.currency,
    currentPrice: quote?.price ?? null,
  });

  let historicalPrices: HistoricalPrice[] = [];
  const sortedTx = tx.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
  if (sortedTx.length > 0 && coingecko.getHistoricalPrices) {
    try {
      const firstDate = sortedTx[0].date;
      historicalPrices = await coingecko.getHistoricalPrices({
        symbol: upper,
        currency: asset.currency,
        from: addDays(firstDate, -2),
        to: addDays(new Date(), 1),
      });
      historicalPrices.sort((a, b) => a.asOf.getTime() - b.asOf.getTime());
    } catch {
      historicalPrices = [];
    }
  }

  // timeseries: cumulative invested vs value at each transaction date's historical price.
  let cumInvested = 0;
  let cumQty = 0;
  const currentPrice = quote?.price ?? null;
  const series = sortedTx
    .map((t) => {
      if (t.transactionType === "buy") {
        cumInvested += t.price * t.quantity + (t.fee ?? 0);
        cumQty += t.quantity;
      } else if (t.transactionType === "sell") {
        // MVP: treat as reducing quantity; value series still computed using currentPrice
        cumQty -= Math.min(cumQty, t.quantity);
      }
      const historical = findHistoricalPriceAtOrBefore(historicalPrices, t.date);
      const priceAtDate =
        historical?.price ??
        t.price ??
        (t.date.toDateString() === new Date().toDateString() ? currentPrice : null);
      const value = priceAtDate == null ? 0 : cumQty * priceAtDate;
      const returnRatePct =
        cumInvested > 0 ? ((value - cumInvested) / cumInvested) * 100 : null;
      return {
        date: t.date.toISOString(),
        invested: cumInvested,
        value,
        price: priceAtDate,
        returnRatePct,
      };
    });

  const buyCount = tx.filter((t) => t.transactionType === "buy").length;

  return NextResponse.json({
    asset: {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
      currency: asset.currency,
    },
    quote: quote ? { ...quote, asOf: quote.asOf.toISOString() } : null,
    performance,
    buyCount,
    series,
    note:
      historicalPrices.length > 0
        ? "Series 'value' uses CoinGecko historical prices at each transaction date."
        : "Historical prices were unavailable, so each transaction price is used as the point-in-time fallback.",
  });
}

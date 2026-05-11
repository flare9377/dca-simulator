import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { computePerformance, computePortfolioSummary } from "@/lib/portfolio/calc";
import { chainProviders } from "@/lib/prices/providers/chain";
import { createCoinGeckoProvider } from "@/lib/prices/providers/coingecko";
import { createManualProvider } from "@/lib/prices/providers/manual";
import type { HistoricalPrice } from "@/lib/prices/types";

function decToNumber(x: unknown): number {
  // Prisma Decimal is compatible with String() and Number()
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

export async function GET() {
  const assets = await prisma.asset.findMany({
    include: {
      transactions: { orderBy: { date: "asc" } },
      priceSnapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const manual = createManualProvider({
    async getLastKnown({ symbol, currency }) {
      const asset = assets.find((a) => a.symbol === symbol && a.currency === currency);
      const snap = asset?.priceSnapshots?.[0];
      if (!snap) return null;
      return { price: decToNumber(snap.price), asOf: snap.timestamp };
    },
  });
  const coingecko = createCoinGeckoProvider();
  const provider = chainProviders([coingecko, manual]);

  const perAsset = await Promise.all(
    assets.map(async (a) => {
      const symbol = a.symbol;
      const currency = a.currency;

      let quote: { price: number; source: string; asOf: Date } | null = null;
      try {
        const q = await provider.getQuote({ symbol, currency });
        quote = { price: q.price, source: q.source, asOf: q.asOf };
        if (q.source === "coingecko" && q.price > 0) {
          await prisma.priceSnapshot.create({
            data: {
              assetId: a.id,
              price: String(q.price),
              currency: q.currency,
              source: q.source,
              timestamp: q.asOf,
            },
          });
        }
      } catch {
        // Ignore: handled by manual provider chain when possible.
      }

      const tx = a.transactions.map((t) => ({
        transactionType: t.transactionType,
        date: t.date,
        price: decToNumber(t.price),
        quantity: decToNumber(t.quantity),
        fee: decToNumber(t.fee),
        currency: t.currency,
      }));

      const perf = computePerformance({
        transactions: tx,
        currency,
        currentPrice: quote?.price ?? null,
      });

      return {
        asset: {
          id: a.id,
          symbol: a.symbol,
          name: a.name,
          assetType: a.assetType,
          currency: a.currency,
        },
        quote: quote
          ? { price: quote.price, source: quote.source, asOf: quote.asOf }
          : null,
        performance: perf,
      };
    }),
  );

  const summary = computePortfolioSummary(perAsset.map((x) => x.performance));
  const allDates = Array.from(
    new Set(
      assets.flatMap((asset) =>
        asset.transactions.map((tx) => tx.date.toISOString().slice(0, 10)),
      ),
    ),
  ).sort();

  const firstDate = allDates[0] ? new Date(`${allDates[0]}T00:00:00.000Z`) : null;
  const historicalByAsset = new Map<string, HistoricalPrice[]>();

  if (firstDate && coingecko.getHistoricalPrices) {
    await Promise.all(
      assets.map(async (asset) => {
        try {
          const prices = await coingecko.getHistoricalPrices?.({
            symbol: asset.symbol,
            currency: asset.currency,
            from: addDays(firstDate, -2),
            to: addDays(new Date(), 1),
          });
          historicalByAsset.set(
            asset.id,
            (prices ?? []).sort((a, b) => a.asOf.getTime() - b.asOf.getTime()),
          );
        } catch {
          historicalByAsset.set(asset.id, []);
        }
      }),
    );
  }

  const history = allDates.map((dateKey) => {
    const date = new Date(`${dateKey}T23:59:59.999Z`);
    let totalInvested = 0;
    let totalValue = 0;

    for (const asset of assets) {
      let invested = 0;
      let quantity = 0;
      let lastTxPrice: number | null = null;

      for (const t of asset.transactions) {
        if (t.date.getTime() > date.getTime()) break;

        const price = decToNumber(t.price);
        const qty = decToNumber(t.quantity);
        const fee = decToNumber(t.fee);
        if (qty <= 0) continue;

        if (t.transactionType === "buy") {
          invested += price * qty + fee;
          quantity += qty;
          lastTxPrice = price;
        } else if (t.transactionType === "sell" && quantity > 0) {
          const qtySold = Math.min(qty, quantity);
          const avgPrice = invested / quantity;
          invested -= avgPrice * qtySold;
          quantity -= qtySold;
          lastTxPrice = price;
        }
      }

      const historical = findHistoricalPriceAtOrBefore(
        historicalByAsset.get(asset.id) ?? [],
        date,
      );
      const priceAtDate = historical?.price ?? lastTxPrice;

      totalInvested += invested;
      totalValue += priceAtDate == null ? 0 : quantity * priceAtDate;
    }

    const totalPnl = totalValue - totalInvested;
    const totalReturnRatePct =
      totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null;

    return {
      date: dateKey,
      totalInvested,
      totalValue,
      totalPnl,
      totalReturnRatePct,
    };
  });

  if (history.length > 0) {
    history.push({
      date: "now",
      totalInvested: summary.totalInvested,
      totalValue: summary.totalValue,
      totalPnl: summary.totalPnl,
      totalReturnRatePct: summary.totalReturnRatePct,
    });
  }

  return NextResponse.json({
    summary,
    perAsset,
    history,
  });
}

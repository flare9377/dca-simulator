import type { Currency } from "@prisma/client";
import type { HistoricalPrice, PriceProvider, PriceQuote } from "../types";

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
};

function toVsCurrency(currency: Currency): "usd" | "krw" {
  return currency === "KRW" ? "krw" : "usd";
}

function coinGeckoHeaders() {
  return process.env.COINGECKO_API_KEY
    ? { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY }
    : undefined;
}

export function createCoinGeckoProvider(): PriceProvider {
  return {
    supports(symbol) {
      return symbol.toUpperCase() in COINGECKO_IDS;
    },
    async getQuote({ symbol, currency }): Promise<PriceQuote> {
      const upper = symbol.toUpperCase();
      const id = COINGECKO_IDS[upper];
      if (!id) throw new Error(`CoinGecko does not support symbol: ${symbol}`);

      const vs = toVsCurrency(currency);
      const url =
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
          id,
        )}&vs_currencies=${encodeURIComponent(vs)}&include_last_updated_at=true`;

      const res = await fetch(url, {
        headers: coinGeckoHeaders(),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `CoinGecko error: ${res.status} ${res.statusText} ${text}`.trim(),
        );
      }

      const data = (await res.json()) as Record<
        string,
        Record<string, number> & { last_updated_at?: number }
      >;

      const row = data[id];
      if (!row || typeof row[vs] !== "number") {
        throw new Error(`CoinGecko response missing price for ${symbol}`);
      }

      const last = typeof row.last_updated_at === "number" ? row.last_updated_at : undefined;
      return {
        symbol: upper,
        price: row[vs],
        currency,
        source: "coingecko",
        asOf: last ? new Date(last * 1000) : new Date(),
      };
    },
    async getHistoricalPrices({
      symbol,
      currency,
      from,
      to,
    }): Promise<HistoricalPrice[]> {
      const upper = symbol.toUpperCase();
      const id = COINGECKO_IDS[upper];
      if (!id) throw new Error(`CoinGecko does not support symbol: ${symbol}`);

      const vs = toVsCurrency(currency);
      const fromSeconds = Math.floor(from.getTime() / 1000);
      const toSeconds = Math.floor(to.getTime() / 1000);
      const url =
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
          id,
        )}/market_chart/range?vs_currency=${encodeURIComponent(
          vs,
        )}&from=${fromSeconds}&to=${toSeconds}`;

      const res = await fetch(url, {
        headers: coinGeckoHeaders(),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `CoinGecko historical error: ${res.status} ${res.statusText} ${text}`.trim(),
        );
      }

      const data = (await res.json()) as { prices?: Array<[number, number]> };
      return (data.prices ?? [])
        .filter((row) => Number.isFinite(row[0]) && Number.isFinite(row[1]))
        .map(([timestamp, price]) => ({
          price,
          currency,
          asOf: new Date(timestamp),
        }));
    },
  };
}

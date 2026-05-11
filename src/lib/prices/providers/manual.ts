import type { Currency } from "@prisma/client";
import type { PriceProvider, PriceQuote } from "../types";

/**
 * Manual/last-known price provider.
 * The caller supplies a getter that returns the last snapshot (or null).
 */
export function createManualProvider(args: {
  getLastKnown: (p: {
    symbol: string;
    currency: Currency;
  }) => Promise<{ price: number; asOf: Date } | null>;
}): PriceProvider {
  return {
    supports() {
      return true;
    },
    async getQuote({ symbol, currency }): Promise<PriceQuote> {
      const last = await args.getLastKnown({
        symbol: symbol.toUpperCase(),
        currency,
      });
      if (!last) {
        return {
          symbol: symbol.toUpperCase(),
          price: 0,
          currency,
          source: "manual",
          asOf: new Date(0),
        };
      }
      return {
        symbol: symbol.toUpperCase(),
        price: last.price,
        currency,
        source: "last_known",
        asOf: last.asOf,
      };
    },
  };
}


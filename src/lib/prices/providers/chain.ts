import type { PriceProvider, PriceQuote } from "../types";
import type { Currency } from "@prisma/client";

export function chainProviders(providers: PriceProvider[]): PriceProvider {
  return {
    supports(symbol) {
      return providers.some((p) => p.supports(symbol));
    },
    async getQuote(args: { symbol: string; currency: Currency }): Promise<PriceQuote> {
      let lastErr: unknown = null;
      for (const p of providers) {
        if (!p.supports(args.symbol)) continue;
        try {
          return await p.getQuote(args);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr ?? new Error("No price provider available");
    },
  };
}


import type { Currency, PriceSource } from "@prisma/client";

export type PriceQuote = {
  symbol: string;
  price: number;
  currency: Currency;
  source: PriceSource;
  asOf: Date;
};

export type HistoricalPrice = {
  price: number;
  currency: Currency;
  asOf: Date;
};

export type PriceProvider = {
  supports: (symbol: string) => boolean;
  getQuote: (args: { symbol: string; currency: Currency }) => Promise<PriceQuote>;
  getHistoricalPrices?: (args: {
    symbol: string;
    currency: Currency;
    from: Date;
    to: Date;
  }) => Promise<HistoricalPrice[]>;
};

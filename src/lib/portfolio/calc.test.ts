import { describe, expect, it } from "vitest";
import { computePerformance, computePortfolioSummary } from "./calc";

describe("DCA portfolio calc (sample data)", () => {
  it("computes BTC/ETH average price, pnl, return correctly", () => {
    const btcTx = [
      {
        transactionType: "buy" as const,
        date: new Date("2025-01-01"),
        price: 60000,
        quantity: 0.01,
        fee: 0,
        currency: "USD" as const,
      },
      {
        transactionType: "buy" as const,
        date: new Date("2025-02-01"),
        price: 70000,
        quantity: 0.01,
        fee: 0,
        currency: "USD" as const,
      },
      {
        transactionType: "buy" as const,
        date: new Date("2025-03-01"),
        price: 80000,
        quantity: 0.01,
        fee: 0,
        currency: "USD" as const,
      },
    ];

    const ethTx = [
      {
        transactionType: "buy" as const,
        date: new Date("2025-01-01"),
        price: 2500,
        quantity: 0.2,
        fee: 0,
        currency: "USD" as const,
      },
      {
        transactionType: "buy" as const,
        date: new Date("2025-02-01"),
        price: 3000,
        quantity: 0.2,
        fee: 0,
        currency: "USD" as const,
      },
      {
        transactionType: "buy" as const,
        date: new Date("2025-03-01"),
        price: 3500,
        quantity: 0.2,
        fee: 0,
        currency: "USD" as const,
      },
    ];

    const btc = computePerformance({
      transactions: btcTx,
      currency: "USD",
      currentPrice: 90000,
    });
    expect(btc.quantity).toBeCloseTo(0.03, 10);
    expect(btc.invested).toBeCloseTo(2100, 10);
    expect(btc.avgPrice).toBeCloseTo(70000, 10);
    expect(btc.value).toBeCloseTo(2700, 10);
    expect(btc.pnl).toBeCloseTo(600, 10);
    expect(btc.returnRatePct).toBeCloseTo((600 / 2100) * 100, 10);

    const eth = computePerformance({
      transactions: ethTx,
      currency: "USD",
      currentPrice: 4000,
    });
    expect(eth.quantity).toBeCloseTo(0.6, 10);
    expect(eth.invested).toBeCloseTo(1800, 10);
    expect(eth.avgPrice).toBeCloseTo(3000, 10);
    expect(eth.value).toBeCloseTo(2400, 10);
    expect(eth.pnl).toBeCloseTo(600, 10);
    expect(eth.returnRatePct).toBeCloseTo((600 / 1800) * 100, 10);

    const portfolio = computePortfolioSummary([btc, eth]);
    expect(portfolio.totalInvested).toBeCloseTo(3900, 10);
    expect(portfolio.totalValue).toBeCloseTo(5100, 10);
    expect(portfolio.totalPnl).toBeCloseTo(1200, 10);
    expect(portfolio.totalReturnRatePct).toBeCloseTo((1200 / 3900) * 100, 10);
  });
});


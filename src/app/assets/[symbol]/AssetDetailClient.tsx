"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import clsx from "clsx";

type DetailResponse = {
  asset: {
    id: string;
    symbol: string;
    name: string;
    assetType: "crypto" | "stock" | "etf" | "cash";
    currency: "USD" | "KRW";
  };
  quote: { price: number; source: string; asOf: string } | null;
  performance: {
    invested: number;
    quantity: number;
    avgPrice: number | null;
    currentPrice: number | null;
    value: number;
    pnl: number;
    returnRatePct: number | null;
  };
  buyCount: number;
  series: Array<{
    date: string;
    invested: number;
    value: number;
    returnRatePct: number | null;
  }>;
  note?: string;
};

function fmtMoney(n: number, currency: "USD" | "KRW") {
  const opts: Intl.NumberFormatOptions =
    currency === "KRW"
      ? { style: "currency", currency: "KRW", maximumFractionDigits: 0 }
      : { style: "currency", currency: "USD", maximumFractionDigits: 2 };
  return new Intl.NumberFormat(undefined, opts).format(n);
}

function niceStep(rawStep: number) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function paddedAxis<T extends Record<string, unknown>>(
  rows: T[],
  keys: Array<keyof T>,
): { domain: [number, number]; ticks: number[] } {
  const values = rows
    .flatMap((row) => keys.map((key) => Number(row[key])))
    .filter(Number.isFinite);

  if (values.length === 0) return { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  const pad = Math.max(spread * 0.08, Math.abs(max) * 0.015, 1);
  const lower = Math.max(0, min - pad);
  const upper = max + pad;
  const step = niceStep((upper - lower) / 4);
  const ticks: number[] = [];

  for (let tick = Math.ceil(lower / step) * step; tick < upper; tick += step) {
    ticks.push(Number(tick.toFixed(8)));
  }

  if (!ticks.includes(Number(lower.toFixed(8)))) {
    ticks.unshift(Number(lower.toFixed(8)));
  }
  if (!ticks.includes(Number(upper.toFixed(8)))) {
    ticks.push(Number(upper.toFixed(8)));
  }

  return { domain: [lower, upper], ticks };
}

function paddedPercentAxis(values: Array<number | null | undefined>): {
  domain: [number, number];
  ticks: number[];
} {
  const finite = values.filter((value): value is number => Number.isFinite(value));

  if (finite.length === 0) {
    return { domain: [-1, 1], ticks: [-1, -0.5, 0, 0.5, 1] };
  }

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const spread = max - min;
  const pad = Math.max(spread * 0.12, 1);
  const lower = min - pad;
  const upper = max + pad;
  const step = niceStep((upper - lower) / 4);
  const ticks: number[] = [];

  for (let tick = Math.ceil(lower / step) * step; tick < upper; tick += step) {
    ticks.push(Number(tick.toFixed(8)));
  }

  if (!ticks.includes(Number(lower.toFixed(8)))) ticks.unshift(Number(lower.toFixed(8)));
  if (!ticks.includes(Number(upper.toFixed(8)))) ticks.push(Number(upper.toFixed(8)));

  return { domain: [lower, upper], ticks };
}

function Stat(props: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="text-sm text-zinc-300">{props.label}</div>
      <div
        className={clsx(
          "mt-1 text-2xl font-semibold",
          props.tone === "good"
            ? "text-emerald-400"
            : props.tone === "bad"
              ? "text-rose-400"
              : "text-zinc-100",
        )}
      >
        {props.value}
      </div>
    </div>
  );
}

export function AssetDetailClient(props: { symbol: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/assets/by-symbol/${props.symbol}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setData(null);
          return;
        }
        setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [props.symbol]);

  const currency = data?.asset.currency ?? "USD";
  const tone = (data?.performance.pnl ?? 0) >= 0 ? "good" : "bad";

  const chartData = useMemo(() => {
    return (data?.series ?? []).map((p) => ({
      date: format(new Date(p.date), "yyyy-MM-dd"),
      invested: p.invested,
      value: p.value,
      returnRatePct: p.returnRatePct,
    }));
  }, [data]);

  const chartYAxis = useMemo(
    () => paddedAxis(chartData, ["invested", "value"]),
    [chartData],
  );
  const chartReturnYAxis = useMemo(
    () => paddedPercentAxis(chartData.map((point) => point.returnRatePct)),
    [chartData],
  );

  return (
    <div className="min-h-full bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-300">Asset Detail</div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {data ? (
                <>
                  {data.asset.symbol} <span className="text-zinc-300">— {data.asset.name}</span>
                </>
              ) : (
                props.symbol.toUpperCase()
              )}
            </h1>
            {data?.quote ? (
              <div className="mt-1 text-xs text-zinc-400">
                price source: {data.quote.source} · as of{" "}
                {format(new Date(data.quote.asOf), "yyyy-MM-dd HH:mm")}
              </div>
            ) : (
              <div className="mt-1 text-xs text-zinc-400">
                {loading ? "loading..." : "no price available"}
              </div>
            )}
          </div>
          <Link
            href="/"
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            ← 대시보드
          </Link>
        </div>

        <section className="mt-6 grid grid-cols-4 gap-3">
          <Stat
            label="총 투자금"
            value={data ? fmtMoney(data.performance.invested, currency) : "-"}
          />
          <Stat
            label="현재 평가금액"
            value={data ? fmtMoney(data.performance.value, currency) : "-"}
          />
          <Stat
            label="수익률"
            value={
              data?.performance.returnRatePct == null
                ? "-"
                : `${data.performance.returnRatePct.toFixed(2)}%`
            }
            tone={tone}
          />
          <Stat
            label="매수 횟수"
            value={data ? String(data.buyCount) : "-"}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-semibold text-zinc-200">
              누적 투자금 vs 평가금액 (거래 기반)
            </div>
            <div className="text-xs text-zinc-400">
              {data?.note ?? ""}
            </div>
          </div>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#a1a1aa" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="money"
                  domain={chartYAxis.domain}
                  ticks={chartYAxis.ticks}
                  tickFormatter={(value) => Math.round(Number(value)).toLocaleString()}
                  allowDataOverflow
                  stroke="#a1a1aa"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  yAxisId="return"
                  orientation="right"
                  domain={chartReturnYAxis.domain}
                  ticks={chartReturnYAxis.ticks}
                  tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                  allowDataOverflow
                  stroke="#f59e0b"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: unknown, name: unknown) =>
                    name === "수익률"
                      ? `${Number(v).toFixed(2)}%`
                      : fmtMoney(Number(v), currency)
                  }
                  contentStyle={{
                    background: "#09090b",
                    border: "1px solid #27272a",
                    borderRadius: 12,
                    color: "#e4e4e7",
                  }}
                />
                <Legend />
                <Line
                  yAxisId="money"
                  type="monotone"
                  dataKey="invested"
                  name="누적 투자금"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="money"
                  type="monotone"
                  dataKey="value"
                  name="평가금액"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="return"
                  type="monotone"
                  dataKey="returnRatePct"
                  name="수익률"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-xs text-zinc-400">
            다음 단계로 `PriceSnapshot`을 주기적으로 적재하면, “평가금액”을 과거 시점의 실제 가격으로 그릴 수 있습니다.
          </div>
        </section>
      </div>
    </div>
  );
}

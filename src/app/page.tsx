"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { LogOut, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import clsx from "clsx";

type Asset = {
  id: string;
  symbol: string;
  name: string;
  assetType: "crypto" | "stock" | "etf" | "cash";
  currency: "USD" | "KRW";
};

type PortfolioResponse = {
  summary: {
    totalInvested: number;
    totalValue: number;
    totalPnl: number;
    totalReturnRatePct: number | null;
    weights: { value: number; weightPct: number }[];
  };
  perAsset: Array<{
    asset: Asset;
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
  }>;
  history: Array<{
    date: string;
    totalInvested: number;
    totalValue: number;
    totalPnl: number;
    totalReturnRatePct: number | null;
  }>;
};

type TransactionRow = {
  id: string;
  date: string;
  transactionType: "buy" | "sell";
  price: string;
  quantity: string;
  fee: string;
  currency: "USD" | "KRW";
  memo: string | null;
  asset: Asset;
};

function fmtMoney(n: number, currency: "USD" | "KRW") {
  const opts: Intl.NumberFormatOptions =
    currency === "KRW"
      ? { style: "currency", currency: "KRW", maximumFractionDigits: 0 }
      : { style: "currency", currency: "USD", maximumFractionDigits: 2 };
  return new Intl.NumberFormat(undefined, opts).format(n);
}

function fmtNum(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(n);
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

function StatCard(props: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "neutral" }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="text-sm text-zinc-400">{props.label}</div>
      <div
        className={clsx(
          "mt-1 text-2xl font-semibold",
          props.tone === "good" && "text-emerald-400",
          props.tone === "bad" && "text-rose-400",
        )}
      >
        {props.value}
      </div>
      {props.sub ? <div className="mt-1 text-xs text-zinc-500">{props.sub}</div> : null}
    </div>
  );
}

function AssetCard(props: {
  item: PortfolioResponse["perAsset"][number];
}) {
  const { asset, performance, quote } = props.item;
  const tone = performance.pnl >= 0 ? "good" : "bad";
  return (
    <Link
      href={`/assets/${asset.symbol}`}
      className="block rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 hover:bg-zinc-900/70 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">{asset.name}</div>
          <div className="text-xl font-semibold">{asset.symbol}</div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          {quote ? (
            <>
              <div>source: {quote.source}</div>
              <div>as of {format(new Date(quote.asOf), "yyyy-MM-dd HH:mm")}</div>
            </>
          ) : (
            <div>no price</div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-zinc-500">보유수량</div>
          <div className="font-medium text-zinc-100">{fmtNum(performance.quantity)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">평균 매수가</div>
          <div className="font-medium text-zinc-100">
            {performance.avgPrice == null ? "-" : fmtMoney(performance.avgPrice, asset.currency)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">현재가</div>
          <div className="font-medium text-zinc-100">
            {performance.currentPrice == null ? "-" : fmtMoney(performance.currentPrice, asset.currency)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">평가금액</div>
          <div className="font-medium text-zinc-100">{fmtMoney(performance.value, asset.currency)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <div className="text-xs text-zinc-500">투자금</div>
          <div className="font-medium text-zinc-100">{fmtMoney(performance.invested, asset.currency)}</div>
        </div>
        <div className={clsx("text-right", tone === "good" ? "text-emerald-400" : "text-rose-400")}>
          <div className="text-xs text-zinc-500">손익 / 수익률</div>
          <div className="font-semibold">
            {fmtMoney(performance.pnl, asset.currency)}{" "}
            <span className="text-sm">
              ({performance.returnRatePct == null ? "-" : performance.returnRatePct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function TransactionModal(props: {
  open: boolean;
  assets: Asset[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [assetId, setAssetId] = useState<string>("");
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [price, setPrice] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [fee, setFee] = useState<string>("0");
  const [memo, setMemo] = useState<string>("");

  const firstAssetId = props.assets[0]?.id ?? "";
  const effectiveAssetId = assetId || firstAssetId;
  const effectiveAsset =
    props.assets.find((a) => a.id === effectiveAssetId) ?? null;

  if (!props.open) return null;

  async function submit() {
    if (!effectiveAsset) return;
    const payload = {
      assetId: effectiveAsset.id,
      transactionType: "buy",
      date: new Date(date).toISOString(),
      price: Number(price),
      quantity: Number(quantity),
      fee: Number(fee || "0"),
      currency: effectiveAsset.currency,
      memo: memo || undefined,
    };
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      alert(`Failed: ${text}`);
      return;
    }
    props.onCreated();
    props.onClose();
    setPrice("");
    setQuantity("");
    setFee("0");
    setMemo("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl text-zinc-100">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">거래 추가 (DCA)</div>
          <button className="rounded-lg px-2 py-1 text-zinc-200 hover:bg-zinc-900" onClick={props.onClose}>
            닫기
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">자산</span>
            <select
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              value={effectiveAssetId}
              onChange={(e) => setAssetId(e.target.value)}
            >
              {props.assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} — {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">매수일</span>
            <input className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">
              매수 가격 ({effectiveAsset?.currency ?? "USD"})
            </span>
            <input className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="예: 70000" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">매수 수량</span>
            <input className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="예: 0.01" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">
              수수료 ({effectiveAsset?.currency ?? "USD"})
            </span>
            <input className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm col-span-2">
            <span className="text-zinc-200">메모</span>
            <input className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 2월 DCA" />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-xl border border-zinc-800 px-4 py-2 hover:bg-zinc-900" onClick={props.onClose}>
            취소
          </button>
          <button className="rounded-xl bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800" onClick={submit}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function TransactionEditModal(props: {
  transaction: TransactionRow | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const tx = props.transaction;
  const [price, setPrice] = useState<string>(tx?.price ?? "");
  const [quantity, setQuantity] = useState<string>(tx?.quantity ?? "");
  const [memo, setMemo] = useState<string>(tx?.memo ?? "");

  if (!tx) return null;

  async function submit() {
    if (!tx) return;

    const payload = {
      price: Number(price),
      quantity: Number(quantity),
      memo: memo.trim() === "" ? null : memo,
    };

    const res = await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      alert(`Failed: ${text}`);
      return;
    }

    props.onUpdated();
    props.onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl text-zinc-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">거래 수정</div>
            <div className="mt-1 text-xs text-zinc-400">
              {tx.asset.symbol} · {format(new Date(tx.date), "yyyy-MM-dd")}
            </div>
          </div>
          <button className="rounded-lg px-2 py-1 text-zinc-200 hover:bg-zinc-900" onClick={props.onClose}>
            닫기
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">매수가 ({tx.currency})</span>
            <input
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">수량</span>
            <input
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="col-span-2 grid gap-1 text-sm">
            <span className="text-zinc-200">메모</span>
            <input
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-xl border border-zinc-800 px-4 py-2 hover:bg-zinc-900" onClick={props.onClose}>
            취소
          </button>
          <button className="rounded-xl bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800" onClick={submit}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetModal(props: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [symbol, setSymbol] = useState("BTC");
  const [name, setName] = useState("Bitcoin");
  const [assetType, setAssetType] = useState<Asset["assetType"]>("crypto");
  const [currency, setCurrency] = useState<Asset["currency"]>("USD");

  if (!props.open) return null;

  async function submit() {
    const payload = { symbol, name, assetType, currency };
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      alert(`Failed: ${text}`);
      return;
    }
    props.onCreated();
    props.onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl text-zinc-100">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">자산 등록</div>
          <button className="rounded-lg px-2 py-1 text-zinc-200 hover:bg-zinc-900" onClick={props.onClose}>
            닫기
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">티커</span>
            <input className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">자산명</span>
            <input className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">자산 유형</span>
            <select className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" value={assetType} onChange={(e) => setAssetType(e.target.value as Asset["assetType"])}>
              <option value="crypto">crypto</option>
              <option value="stock">stock</option>
              <option value="etf">ETF</option>
              <option value="cash">cash</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-200">기준 통화</span>
            <select className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" value={currency} onChange={(e) => setCurrency(e.target.value as Asset["currency"])}>
              <option value="USD">USD</option>
              <option value="KRW">KRW</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-xl border border-zinc-800 px-4 py-2 hover:bg-zinc-900" onClick={props.onClose}>
            취소
          </button>
          <button className="rounded-xl bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800" onClick={submit}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tx, setTx] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionRow | null>(null);
  const [txPage, setTxPage] = useState(1);

  async function refreshAll() {
    setLoading(true);
    try {
      const [p, a, t] = await Promise.all([
        fetch("/api/portfolio", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/assets", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/transactions", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setPortfolio(p);
      setAssets(a.assets);
      setTx(t.transactions);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Defer to avoid react-hooks/set-state-in-effect lint rule
    const id = setTimeout(() => void refreshAll(), 0);
    return () => clearTimeout(id);
  }, []);

  const currency: "USD" | "KRW" = useMemo(() => {
    const first = portfolio?.perAsset?.[0]?.asset?.currency;
    return first ?? "USD";
  }, [portfolio]);

  const pieData = useMemo(() => {
    if (!portfolio) return [];
    return portfolio.perAsset.map((x) => ({
      name: x.asset.symbol,
      value: x.performance.value,
    }));
  }, [portfolio]);

  const pieTotal = useMemo(
    () => pieData.reduce((sum, item) => sum + item.value, 0),
    [pieData],
  );

  function renderPieLegend(value: unknown) {
    const name = String(value);
    const item = pieData.find((x) => x.name === name);
    const pct = item && pieTotal > 0 ? ` ${((item.value / pieTotal) * 100).toFixed(1)}%` : "";
    return `${name}${pct}`;
  }

  const barData = useMemo(() => {
    if (!portfolio) return [];
    return portfolio.perAsset.map((x) => ({
      name: x.asset.symbol,
      invested: x.performance.invested,
      value: x.performance.value,
    }));
  }, [portfolio]);

  const lineData = useMemo(() => {
    if (!portfolio) return [];
    return portfolio.history.map((point) => ({
      name: point.date,
      invested: point.totalInvested,
      value: point.totalValue,
    }));
  }, [portfolio]);

  const lineYAxis = useMemo(
    () => paddedAxis(lineData, ["invested", "value"]),
    [lineData],
  );

const colors = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];
  const txPageSize = 5;
  const totalTxPages = Math.max(1, Math.ceil(tx.length / txPageSize));
  const safeTxPage = Math.min(txPage, totalTxPages);
  const visibleTx = tx.slice(
    (safeTxPage - 1) * txPageSize,
    safeTxPage * txPageSize,
  );

  async function deleteTx(id: string) {
    const ok = confirm("삭제할까요?");
    if (!ok) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) alert("삭제 실패");
    await refreshAll();
  }

  const totalTone =
    (portfolio?.summary.totalPnl ?? 0) >= 0 ? ("good" as const) : ("bad" as const);

  return (
    <div className="min-h-full bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-6xl p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-400">Personal Dashboard</div>
            <h1 className="text-2xl font-semibold tracking-tight">DCA Portfolio</h1>
          </div>
          <div className="flex items-center gap-2">
            <form action="/api/auth/logout" method="post">
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm hover:bg-zinc-900"
                type="submit"
              >
                <LogOut size={16} />
                로그아웃
              </button>
            </form>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm hover:bg-zinc-900"
              onClick={() => void refreshAll()}
              disabled={loading}
            >
              <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
              새로고침
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm hover:bg-zinc-900"
              onClick={() => setAssetModalOpen(true)}
            >
              자산 등록
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
              onClick={() => setModalOpen(true)}
            >
              <Plus size={16} />
              거래 추가
            </button>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="전체 투자금" value={portfolio ? fmtMoney(portfolio.summary.totalInvested, currency) : "-"} />
          <StatCard label="전체 평가금액" value={portfolio ? fmtMoney(portfolio.summary.totalValue, currency) : "-"} />
          <StatCard
            label="전체 손익"
            value={portfolio ? fmtMoney(portfolio.summary.totalPnl, currency) : "-"}
            tone={totalTone}
          />
          <StatCard
            label="전체 수익률"
            value={
              portfolio?.summary.totalReturnRatePct == null
                ? "-"
                : `${portfolio.summary.totalReturnRatePct.toFixed(2)}%`
            }
            tone={totalTone}
          />
        </section>

        <section className="mt-6">
          <div className="mb-3 text-sm font-semibold text-zinc-200">자산별</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {portfolio?.perAsset?.map((x) => (
              <AssetCard key={x.asset.id} item={x} />
            )) ?? (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-zinc-400">
                아직 자산이 없습니다. 시드 데이터를 넣거나 자산을 등록하세요.
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="text-sm font-semibold text-zinc-200">자산별 비중</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={80}
                  >
                    {pieData.map((_entry, idx) => (
                      <Cell key={idx} fill={colors[idx % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmtMoney(Number(v), currency)} />
                  <Legend formatter={renderPieLegend} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 lg:col-span-2">
            <div className="text-sm font-semibold text-zinc-200">투자금 vs 평가금액</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v: unknown) => fmtMoney(Number(v), currency)} />
                  <Legend />
                  <Bar dataKey="invested" name="투자금" fill="#94a3b8" />
                  <Bar dataKey="value" name="평가금액" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 lg:col-span-3">
            <div className="text-sm font-semibold text-zinc-200">포트폴리오 가치 변화</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" />
                  <YAxis
                    domain={lineYAxis.domain}
                    ticks={lineYAxis.ticks}
                    tickFormatter={(value) => Math.round(Number(value)).toLocaleString()}
                    allowDataOverflow
                  />
                  <Tooltip formatter={(v: unknown) => fmtMoney(Number(v), currency)} />
                  <Legend />
                  <Line type="monotone" dataKey="invested" name="누적 투자금" stroke="#94a3b8" strokeWidth={2} />
                  <Line type="monotone" dataKey="value" name="평가금액" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              거래일별 보유 수량과 과거 가격을 기준으로 포트폴리오 평가금액을 계산합니다. 과거 가격이 없으면 해당 거래의 매수가를 fallback으로 사용합니다.
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 text-sm font-semibold text-zinc-200">거래 내역</div>
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60">
            <table className="w-full text-sm text-zinc-100">
              <thead className="bg-zinc-950 text-left text-xs text-zinc-200">
                <tr>
                  <th className="px-4 py-3">거래일</th>
                  <th className="px-4 py-3">티커</th>
                  <th className="px-4 py-3">매수가</th>
                  <th className="px-4 py-3">수량</th>
                  <th className="px-4 py-3">수수료</th>
                  <th className="px-4 py-3">총액</th>
                  <th className="px-4 py-3">메모</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visibleTx.map((t) => {
                  const price = Number(t.price);
                  const qty = Number(t.quantity);
                  const feeVal = Number(t.fee);
                  const total = price * qty + feeVal;
                  return (
                    <tr
                      key={t.id}
                      className="cursor-pointer border-t border-zinc-900 text-zinc-100 hover:bg-zinc-900/50"
                      onClick={() => setEditingTx(t)}
                    >
                      <td className="px-4 py-3">{format(new Date(t.date), "yyyy-MM-dd")}</td>
                      <td className="px-4 py-3 font-medium">{t.asset.symbol}</td>
                      <td className="px-4 py-3">{fmtMoney(price, t.currency)}</td>
                      <td className="px-4 py-3">{fmtNum(qty)}</td>
                      <td className="px-4 py-3">{fmtMoney(feeVal, t.currency)}</td>
                      <td className="px-4 py-3">{fmtMoney(total, t.currency)}</td>
                      <td className="px-4 py-3 text-zinc-100">{t.memo ?? ""}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-rose-400 hover:bg-rose-950/40"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteTx(t.id);
                          }}
                        >
                          <Trash2 size={14} />
                          삭제
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {tx.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-zinc-400" colSpan={8}>
                      거래 내역이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {tx.length > txPageSize ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-zinc-400">
                총 {tx.length}개 중 {(safeTxPage - 1) * txPageSize + 1}-
                {Math.min(safeTxPage * txPageSize, tx.length)}개 표시
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalTxPages }, (_, idx) => idx + 1).map((page) => (
                  <button
                    key={page}
                    className={clsx(
                      "min-w-9 rounded-lg border px-3 py-1.5",
                      safeTxPage === page
                        ? "border-zinc-600 bg-zinc-800 text-white"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:bg-zinc-900",
                    )}
                    onClick={() => setTxPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <TransactionModal
        open={modalOpen}
        assets={assets}
        onClose={() => setModalOpen(false)}
        onCreated={() => void refreshAll()}
      />

      <AssetModal
        open={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        onCreated={() => void refreshAll()}
      />

      <TransactionEditModal
        key={editingTx?.id ?? "no-edit"}
        transaction={editingTx}
        onClose={() => setEditingTx(null)}
        onUpdated={() => void refreshAll()}
      />
    </div>
  );
}

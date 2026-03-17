"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type {
  ProjectionYearState,
  ProjectionRunSummary,
} from "@/server/simulation/types";

type RunData = {
  id: string;
  label: string | null;
  success: boolean;
  firstDepletionYear: number | null;
  endingBalance: string;
  endingNetWorth: string;
  totalWithdrawals: string;
  totalTaxes: string;
  projectionStartYear: number;
  projectionEndYear: number;
  yearsProjected: number;
  createdAt: string;
  outputJson: {
    yearByYear: ProjectionYearState[];
    summary: ProjectionRunSummary;
  };
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtK(n: number) {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}K`;
  }
  return fmt(n);
}

// Simple SVG polyline chart — no external libraries
function LineChart({
  data,
  xKey,
  yKey,
  color = "#3b82f6",
}: {
  data: Record<string, number>[];
  xKey: string;
  yKey: string;
  color?: string;
}) {
  if (!data.length) return null;
  const values = data.map((d) => d[yKey] ?? 0);
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const W = 800;
  const H = 220;
  const PAD_L = 60;
  const PAD_R = 20;
  const PAD_T = 20;
  const PAD_B = 30;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const toX = (i: number) =>
    PAD_L + (i / Math.max(data.length - 1, 1)) * plotW;
  const toY = (v: number) =>
    PAD_T + plotH - ((v - min) / range) * plotH;

  const points = data
    .map((d, i) => `${toX(i)},${toY(d[yKey] ?? 0)}`)
    .join(" ");

  // Zero line
  const zeroY = toY(0);

  // Label every ~8 points
  const step = Math.max(1, Math.floor(data.length / 8));
  const labelIndices = data
    .map((_, i) => i)
    .filter((i) => i === 0 || i % step === 0 || i === data.length - 1);

  // Y-axis ticks
  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    min + (range / yTicks) * i
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Y-axis grid lines and labels */}
      {yTickValues.map((v, i) => {
        const y = toY(v);
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text
              x={PAD_L - 4}
              y={y + 4}
              textAnchor="end"
              fontSize="9"
              fill="#94a3b8"
            >
              {fmtK(v)}
            </text>
          </g>
        );
      })}

      {/* Zero line (if visible) */}
      {min < 0 && (
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={zeroY}
          y2={zeroY}
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="4 2"
        />
      )}

      {/* The line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* X-axis labels */}
      {labelIndices.map((i) => (
        <text
          key={i}
          x={toX(i)}
          y={H - 6}
          textAnchor="middle"
          fontSize="9"
          fill="#64748b"
        >
          {data[i][xKey]}
        </text>
      ))}
    </svg>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "red" | "neutral";
}) {
  const colors = {
    green: "border-green-200 bg-green-50",
    red: "border-red-200 bg-red-50",
    neutral: "border-slate-200 bg-white",
  };
  return (
    <div
      className={`rounded-xl border p-4 ${colors[highlight ?? "neutral"]}`}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const PAGE_SIZE = 20;

export default function SimulationRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const [run, setRun] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch(`/api/simulations/${runId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setRun(data.run);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load simulation");
        setLoading(false);
      });
  }, [runId]);

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-400">
        Loading projection...
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="text-center py-20 text-red-500">
        {error || "Projection not found"}
      </div>
    );
  }

  const { yearByYear, summary } = run.outputJson;

  // Build chart data
  const chartData = yearByYear.map((y) => ({
    year: y.year,
    assets: Math.round(y.endingTotalAssets),
    netWorth: Math.round(y.netWorth),
    income: Math.round(y.totalIncome),
    expenses: Math.round(y.expenses),
  }));

  // Paginate year-by-year table
  const totalPages = Math.ceil(yearByYear.length / PAGE_SIZE);
  const pageRows = yearByYear.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  // Get member ids for age display
  const memberIds = yearByYear.length > 0
    ? Object.keys(yearByYear[0].memberAges)
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/app/simulations")}
            className="mb-2 -ml-2"
          >
            Back to Projections
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">
            {run.label || "Baseline Projection"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Run on {new Date(run.createdAt).toLocaleString()} &middot;{" "}
            {run.projectionStartYear}–{run.projectionEndYear} &middot;{" "}
            {run.yearsProjected} years projected
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <SummaryCard
          label="Outcome"
          value={run.success ? "Funded" : "Depletes"}
          sub={
            run.success
              ? "Portfolio lasts through life expectancy"
              : `Depletes in ${run.firstDepletionYear}`
          }
          highlight={run.success ? "green" : "red"}
        />
        <SummaryCard
          label="Ending Balance"
          value={fmtK(Number(run.endingBalance))}
          sub={`as of ${run.projectionEndYear}`}
        />
        <SummaryCard
          label="Ending Net Worth"
          value={fmtK(Number(run.endingNetWorth))}
        />
        <SummaryCard
          label="Total Withdrawals"
          value={fmtK(Number(run.totalWithdrawals))}
          sub="over projection period"
        />
        <SummaryCard
          label="Total Taxes"
          value={fmtK(Number(run.totalTaxes))}
          sub="estimated (planning grade)"
        />
      </div>

      {/* Asset balance chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">
          Portfolio Balance Over Time
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Total investable assets by year
        </p>
        <LineChart data={chartData} xKey="year" yKey="assets" color="#3b82f6" />
      </div>

      {/* Income vs Expenses chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">
          Income vs Expenses
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Annual earned + benefit income versus total living expenses
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-blue-600 mb-2">Income</p>
            <LineChart
              data={chartData}
              xKey="year"
              yKey="income"
              color="#3b82f6"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-orange-600 mb-2">
              Expenses
            </p>
            <LineChart
              data={chartData}
              xKey="year"
              yKey="expenses"
              color="#f97316"
            />
          </div>
        </div>
      </div>

      {/* Year-by-year table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Year-by-Year Detail
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {yearByYear.length} years &middot; page {page + 1} of{" "}
              {totalPages}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">
                  Year
                </th>
                {memberIds.map((mid) => (
                  <th
                    key={mid}
                    className="text-center px-3 py-2 font-medium text-slate-600"
                  >
                    Age
                  </th>
                ))}
                <th className="text-right px-3 py-2 font-medium text-slate-600">
                  Income
                </th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">
                  Benefits
                </th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">
                  Expenses
                </th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">
                  Taxes
                </th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">
                  Withdrawal
                </th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">
                  Shortfall
                </th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">
                  Ending Balance
                </th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">
                  Net Worth
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((yr) => (
                <tr
                  key={yr.year}
                  className={`hover:bg-slate-50 ${yr.depleted ? "bg-red-50" : ""}`}
                >
                  <td className="px-3 py-2 font-medium text-slate-700">
                    {yr.year}
                    {yr.depleted && (
                      <span className="ml-1 text-red-500 text-xs">!</span>
                    )}
                  </td>
                  {memberIds.map((mid) => (
                    <td
                      key={mid}
                      className="px-3 py-2 text-center text-slate-600"
                    >
                      {yr.memberAlive[mid]
                        ? yr.memberAges[mid]
                        : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right text-slate-700">
                    {fmtK(yr.earnedIncome)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {fmtK(yr.benefitsIncome)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {fmtK(yr.expenses)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {fmtK(yr.taxes)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {yr.actualWithdrawal > 0 ? fmtK(yr.actualWithdrawal) : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${yr.shortfall > 0 ? "text-red-600 font-medium" : "text-slate-400"}`}
                  >
                    {yr.shortfall > 0 ? fmtK(yr.shortfall) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">
                    {fmtK(yr.endingTotalAssets)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${yr.netWorth < 0 ? "text-red-600" : "text-slate-700"}`}
                  >
                    {fmtK(yr.netWorth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

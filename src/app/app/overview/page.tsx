import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHouseholdOverview } from "@/server/services/overviewService";
import { getProfileCompletion } from "@/server/services/profileCompletionService";
import { computeHealthScore } from "@/server/health/healthScoreService";
import {
  TIER_BG_CLASSES,
  TIER_TEXT_CLASSES,
  TIER_BADGE_CLASSES,
} from "@/server/health/types";
import Link from "next/link";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function MiniScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / 100, 1);
  const offset = circumference * (1 - pct);
  const stroke =
    pct >= 0.9
      ? "#16a34a"
      : pct >= 0.75
      ? "#0d9488"
      : pct >= 0.6
      ? "#ca8a04"
      : pct >= 0.4
      ? "#ea580c"
      : "#dc2626";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={6}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth={6}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.28}
        fontWeight={700}
        fill={stroke}
      >
        {score}
      </text>
    </svg>
  );
}

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const household = await prisma.household.findUnique({
    where: { primaryUserId: session.user.id },
  });
  if (!household) redirect("/onboarding");

  const [overview, completion, healthScore] = await Promise.all([
    getHouseholdOverview(household.id),
    getProfileCompletion(household.id),
    computeHealthScore(household.id, prisma),
  ]);

  const statCards = [
    {
      label: "Total Annual Income",
      value: fmt(overview.totalAnnualIncome),
      href: "/app/income",
    },
    {
      label: "Total Assets",
      value: fmt(overview.totalAssets),
      href: "/app/assets",
    },
    {
      label: "Total Liabilities",
      value: fmt(overview.totalLiabilities),
      href: "/app/liabilities",
    },
    {
      label: "Net Worth",
      value: fmt(overview.netWorth),
      href: "/app/assets",
    },
    {
      label: "Annual Expenses",
      value: overview.monthlyRetirementSpending
        ? fmt(overview.monthlyRetirementSpending * 12)
        : "—",
      href: "/app/expenses",
    },
    {
      label: "Active Benefits",
      value: String(overview.activeBenefitsCount),
      href: "/app/benefits",
    },
    {
      label: "Properties",
      value: String(overview.propertiesCount),
      href: "/app/housing",
    },
    {
      label: "Income Sources",
      value: String(overview.incomeSourcesCount),
      href: "/app/income",
    },
  ];

  const hsBg   = TIER_BG_CLASSES[healthScore.tier];
  const hsText = TIER_TEXT_CLASSES[healthScore.tier];
  const hsBadge = TIER_BADGE_CLASSES[healthScore.tier];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Financial Overview</h1>
        <p className="text-slate-500 mt-1">{household.name}</p>
      </div>

      {/* ── Retirement Health Score Hero ── */}
      <Link
        href="/app/plan-health"
        className={`block rounded-xl border p-6 hover:shadow-md transition-shadow ${hsBg}`}
      >
        <div className="flex items-center gap-6">
          <MiniScoreRing score={healthScore.totalScore} size={80} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-lg font-bold ${hsText}`}>
                Retirement Health Score
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${hsBadge}`}>
                {healthScore.tierLabel} · {healthScore.totalScore}/100
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1 line-clamp-2">
              {healthScore.summary}
            </p>
            {healthScore.topActions.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Top action: {healthScore.topActions[0]}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 text-slate-400 text-sm hidden md:block">
            View details →
          </div>
        </div>
      </Link>

      {/* ── Profile Completion ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Profile Completion</h2>
          <span className="text-2xl font-bold text-blue-600">
            {completion.percentage}%
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all"
            style={{ width: `${completion.percentage}%` }}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {completion.categories.map((cat) => (
            <div key={cat.key} className="flex items-center gap-2 text-sm">
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  cat.complete ? "bg-green-500" : "bg-slate-300"
                }`}
              />
              <span className={cat.complete ? "text-slate-700" : "text-slate-400"}>
                {cat.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
              {card.label}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1">{card.value}</p>
          </Link>
        ))}
      </div>

      {/* ── Quick Links ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Add Financial Data</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/app/income", label: "Add Income" },
            { href: "/app/assets", label: "Add Asset" },
            { href: "/app/liabilities", label: "Add Liability" },
            { href: "/app/benefits", label: "Add Benefit" },
            { href: "/app/housing", label: "Add Property" },
            { href: "/app/expenses", label: "Set Expenses" },
            { href: "/app/insurance", label: "Set Insurance" },
            { href: "/app/assumptions", label: "Set Assumptions" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-center py-2 px-3 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeHealthScore } from "@/server/health/healthScoreService";
import {
  TIER_BG_CLASSES,
  TIER_TEXT_CLASSES,
  TIER_BADGE_CLASSES,
  TIER_LABELS,
} from "@/server/health/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

function ScoreRing({
  score,
  max = 100,
  size = 120,
}: {
  score: number;
  max?: number;
  size?: number;
}) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / max, 1);
  const offset = circumference * (1 - pct);

  // Colour based on score
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
        strokeWidth={8}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth={8}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.22}
        fontWeight={700}
        fill={stroke}
      >
        {score}
      </text>
      <text
        x={size / 2}
        y={size / 2 + size * 0.16}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.1}
        fill="#94a3b8"
      >
        / {max}
      </text>
    </svg>
  );
}

function ComponentBar({
  earned,
  max,
  tierClass,
}: {
  earned: number;
  max: number;
  tierClass: string;
}) {
  const pct = max > 0 ? Math.round((earned / max) * 100) : 0;
  const barColor =
    pct >= 90
      ? "bg-green-500"
      : pct >= 75
      ? "bg-teal-500"
      : pct >= 60
      ? "bg-yellow-500"
      : pct >= 40
      ? "bg-orange-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-16 text-right">
        {earned} / {max} pts
      </span>
    </div>
  );
}

export default async function PlanHealthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const household = await prisma.household.findUnique({
    where: { primaryUserId: session.user.id },
  });
  if (!household) redirect("/onboarding");

  const result = await computeHealthScore(household.id, prisma);

  const bgClass   = TIER_BG_CLASSES[result.tier];
  const textClass = TIER_TEXT_CLASSES[result.tier];
  const badgeClass = TIER_BADGE_CLASSES[result.tier];

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Retirement Health Score</h1>
        <p className="text-slate-500 mt-1">
          A synthesis of your retirement readiness across 7 dimensions — updated each time
          you visit.
        </p>
      </div>

      {/* Hero Score Card */}
      <div className={`rounded-xl border p-8 ${bgClass}`}>
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Score Ring */}
          <div className="flex-shrink-0">
            <ScoreRing score={result.totalScore} size={140} />
          </div>

          {/* Summary */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <h2 className={`text-2xl font-bold ${textClass}`}>
                {result.tierLabel}
              </h2>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badgeClass}`}>
                {result.totalScore} / {result.maxScore}
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">{result.summary}</p>

            {result.topActions.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-1">
                  Top actions to improve your score:
                </p>
                <ul className="list-disc list-inside text-sm text-slate-600 space-y-0.5">
                  {result.topActions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-slate-400 mt-2">
              Last computed: {new Date(result.lastComputedAt).toLocaleString()}
              {result.dataAsOf.latestSimulationDate
                ? ` · Based on simulation from ${new Date(
                    result.dataAsOf.latestSimulationDate
                  ).toLocaleDateString()}`
                : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Score Breakdown</h2>
        <div className="space-y-4">
          {result.components.map((c) => {
            const compBadge = TIER_BADGE_CLASSES[c.tier];
            return (
              <div
                key={c.key}
                className="bg-white rounded-xl border border-slate-200 p-5"
              >
                {/* Component header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{c.label}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${compBadge}`}
                      >
                        {TIER_LABELS[c.tier]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-lg font-bold text-slate-900">
                      {c.earnedPoints}
                    </span>
                    <span className="text-sm text-slate-400"> / {c.maxPoints}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <ComponentBar
                  earned={c.earnedPoints}
                  max={c.maxPoints}
                  tierClass={TIER_TEXT_CLASSES[c.tier]}
                />

                {/* Explanation + CTA */}
                <p className="text-sm text-slate-600 mt-3">{c.explanation}</p>

                {c.actionLabel && c.actionUrl && (
                  <div className="mt-3">
                    <Link
                      href={c.actionUrl}
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {c.actionLabel} →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Data Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            {
              label: "Simulation Run",
              ok: result.dataAsOf.hasSimulation,
              href: "/app/simulations",
            },
            {
              label: "Healthcare Plan",
              ok: result.dataAsOf.hasHealthcarePlan,
              href: "/app/healthcare-planning",
            },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2 text-sm hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  item.ok ? "bg-green-500" : "bg-slate-300"
                }`}
              />
              <span className={item.ok ? "text-slate-700" : "text-slate-400"}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-400 leading-relaxed">
        The Retirement Health Score is a planning-guidance heuristic based on your entered
        data and stored simulation outputs. It is not financial advice, an actuarial
        assessment, or a guarantee of retirement outcomes. Consult a licensed financial
        advisor for personalized guidance.
      </p>
    </div>
  );
}

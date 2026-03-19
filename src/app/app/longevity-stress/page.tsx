'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HealthcarePlanningSummaryItem } from '@/server/healthcare/types';

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function LongevityStressPage() {
  const [runs, setRuns] = useState<HealthcarePlanningSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/longevity-stress')
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Longevity Stress Testing</h1>
          <p className="text-slate-500 text-sm mt-1">
            Explore what happens to your healthcare costs if you live longer than expected.
          </p>
        </div>
        <Link href="/app/healthcare-planning/new">
          <Button>New Analysis with Longevity Stress</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Planning estimates only.</strong> Not medical advice. Consult a healthcare planning
        specialist for personalized guidance.
      </div>

      {/* Educational content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'Why Longevity Risk Matters',
            body: 'A 65-year-old woman today has a 50% chance of living past 88. For a couple, there\'s a 50% chance one partner lives to 92. Healthcare costs compound with time.',
          },
          {
            title: 'Healthcare Cost Growth',
            body: 'Healthcare costs have historically grown 5–7% annually — double the general inflation rate. Over 30 years at 5%, costs nearly quadruple in nominal terms.',
          },
          {
            title: 'What to Model',
            body: 'Run scenarios to age 90, 95, and 100 to see how much additional capital is needed. The difference between base and extended timelines reveals your longevity gap.',
          },
        ].map(({ title, body }) => (
          <div key={title} className="border border-slate-200 rounded-xl p-5 bg-white">
            <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-600">{body}</p>
          </div>
        ))}
      </div>

      {/* Runs list */}
      {loading ? (
        <div className="text-slate-400 py-8 text-center">Loading longevity stress runs...</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-500 mb-4">
            No healthcare planning runs with longevity stress enabled yet.
          </p>
          <Link href="/app/healthcare-planning/new">
            <Button>Create a Longevity Stress Analysis</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-900">Your Longevity Stress Runs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runs.map((run) => (
              <Link
                key={run.runId}
                href={`/app/healthcare-planning/${run.runId}`}
                className="block border border-slate-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-sm transition-all bg-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{run.label}</h3>
                    <p className="text-xs text-slate-400">{run.scenarioName}</p>
                  </div>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    To age {run.longevityTargetAge}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Healthcare Cost</span>
                    <span className="font-medium">{fmt(run.totalHealthcareCost)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Plan Status</span>
                    <span className={run.success ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {run.success ? 'Funded' : `Depleted ${run.firstDepletionYear}`}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  {new Date(run.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

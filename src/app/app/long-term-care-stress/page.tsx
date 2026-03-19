'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HealthcarePlanningSummaryItem } from '@/server/healthcare/types';

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

const LTC_COST_DATA = [
  { type: 'In-Home Care (44 hrs/wk)', national: '$61,776', high: '$98,000+' },
  { type: 'Adult Day Health Care', national: '$20,280', high: '$32,000+' },
  { type: 'Assisted Living Facility', national: '$60,000', high: '$84,000+' },
  { type: 'Memory Care / ALF', national: '$90,000', high: '$130,000+' },
  { type: 'Nursing Home (semi-private)', national: '$104,025', high: '$130,000+' },
  { type: 'Nursing Home (private room)', national: '$119,725', high: '$150,000+' },
];

export default function LongTermCareStressPage() {
  const [runs, setRuns] = useState<HealthcarePlanningSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/long-term-care-stress')
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Long-Term Care Stress Testing</h1>
          <p className="text-slate-500 text-sm mt-1">
            Model the financial impact of a long-term care event on your retirement plan.
          </p>
        </div>
        <Link href="/app/healthcare-planning/new">
          <Button>New Analysis with LTC Stress</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Planning estimates only.</strong> Not medical advice. LTC costs vary significantly
        by location and level of care. Consult a healthcare planning specialist.
      </div>

      {/* Educational content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: '70% Will Need LTC',
            body: 'About 70% of people turning 65 will need some form of long-term care during their lifetime. The average duration of need is 3 years.',
          },
          {
            title: 'Medicare Does Not Cover It',
            body: 'Medicare covers skilled nursing for short stays only (up to 100 days after a qualifying hospital stay). Custodial care — the most common LTC need — is not covered.',
          },
          {
            title: 'Stress Test, Not Prediction',
            body: 'LTC stress testing shows the worst-case impact on your plan, helping you decide whether to self-insure, purchase LTC insurance, or adjust your savings target.',
          },
        ].map(({ title, body }) => (
          <div key={title} className="border border-slate-200 rounded-xl p-5 bg-white">
            <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-600">{body}</p>
          </div>
        ))}
      </div>

      {/* National cost data */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">2024 National LTC Cost Reference</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Source: Genworth Cost of Care Survey (approximate). Costs vary significantly by location.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-2 text-left">Type of Care</th>
              <th className="px-5 py-2 text-right">National Median/yr</th>
              <th className="px-5 py-2 text-right">High-Cost Markets/yr</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {LTC_COST_DATA.map((row) => (
              <tr key={row.type}>
                <td className="px-5 py-2">{row.type}</td>
                <td className="px-5 py-2 text-right font-medium">{row.national}</td>
                <td className="px-5 py-2 text-right text-slate-500">{row.high}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Runs list */}
      {loading ? (
        <div className="text-slate-400 py-8 text-center">Loading LTC stress runs...</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-500 mb-4">
            No healthcare planning runs with LTC stress enabled yet.
          </p>
          <Link href="/app/healthcare-planning/new">
            <Button>Create an LTC Stress Analysis</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-900">Your LTC Stress Runs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runs.map((run) => (
              <Link
                key={run.runId}
                href={`/app/healthcare-planning/${run.runId}`}
                className="block border border-slate-200 rounded-xl p-5 hover:border-orange-300 hover:shadow-sm transition-all bg-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{run.label}</h3>
                    <p className="text-xs text-slate-400">{run.scenarioName}</p>
                  </div>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    LTC Stress
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

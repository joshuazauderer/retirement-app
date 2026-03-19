'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ReportDefinition {
  type: string;
  title: string;
  description: string;
  requiresRunId: boolean;
  supportsComparison: boolean;
  supportsCsv: boolean;
  requiredSourceType: string;
}

interface RunRecord {
  id: string;
  label?: string | null;
  createdAt: string;
  success?: boolean;
  strategy?: string;
  simulationCount?: number;
  scenario?: { name: string } | null;
}

interface RecentRuns {
  TAX_PLANNING?: RunRecord[];
  HEALTHCARE_LONGEVITY?: RunRecord[];
  HOUSING_LEGACY?: RunRecord[];
  MONTE_CARLO_SUMMARY?: RunRecord[];
}

interface ReportsData {
  householdId: string;
  definitions: ReportDefinition[];
  recentRuns: RecentRuns;
}

const REPORT_ICONS: Record<string, string> = {
  HOUSEHOLD_SUMMARY: '🏠',
  SCENARIO_SUMMARY: '📋',
  SCENARIO_COMPARISON: '⚖️',
  MONTE_CARLO_SUMMARY: '🎲',
  TAX_PLANNING: '📊',
  HEALTHCARE_LONGEVITY: '🏥',
  HOUSING_LEGACY: '🏡',
};

function RunBadge({ run, reportType }: { run: RunRecord; reportType: string }) {
  const label = run.label ?? run.scenario?.name ?? 'Unnamed Run';
  const date = new Date(run.createdAt).toLocaleDateString();
  return (
    <Link
      href={`/app/reports/${reportType}/${run.id}`}
      className="block border border-slate-200 rounded-md px-3 py-2 hover:bg-slate-50 transition-colors text-sm no-print"
    >
      <span className="font-medium text-slate-800">{label}</span>
      <span className="ml-2 text-slate-500 text-xs">{date}</span>
      {run.success === false && (
        <span className="ml-2 text-red-500 text-xs font-medium">Depleted</span>
      )}
    </Link>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reports')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Failed to load report data.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-600 mt-1">
          Generate print-ready and exportable reports from your planning runs.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-800">
        <strong>Important:</strong> All reports are planning estimates only. Not legal, tax, medical,
        or investment advice. Consult qualified professionals for specific guidance.
      </div>

      {loading && (
        <p className="text-slate-500">Loading report sources...</p>
      )}
      {error && (
        <p className="text-red-500">{error}</p>
      )}

      {data && (
        <>
          {/* Household Summary — no run ID needed */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Household Overview</h2>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl mb-1">{REPORT_ICONS['HOUSEHOLD_SUMMARY']}</div>
                  <h3 className="font-semibold text-slate-900">Household Retirement Summary</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    High-level household profile and key projected outcomes across all planning runs.
                  </p>
                </div>
                <Link
                  href={`/app/reports/HOUSEHOLD_SUMMARY/household`}
                  className="no-print ml-4 px-4 py-2 bg-slate-900 text-white text-sm rounded-md hover:bg-slate-700 transition-colors"
                >
                  View Report
                </Link>
              </div>
            </div>
          </section>

          {/* Run-based reports */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Planning Run Reports</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {data.definitions
                .filter((d) => d.requiresRunId && d.type !== 'SCENARIO_COMPARISON' && d.type !== 'SCENARIO_SUMMARY')
                .map((def) => {
                  const runs = data.recentRuns[def.type as keyof RecentRuns] ?? [];
                  return (
                    <div key={def.type} className="bg-white border border-slate-200 rounded-lg p-5">
                      <div className="text-2xl mb-2">{REPORT_ICONS[def.type] ?? '📄'}</div>
                      <h3 className="font-semibold text-slate-900">{def.title}</h3>
                      <p className="text-sm text-slate-600 mt-1 mb-3">{def.description}</p>
                      {runs.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">No runs available yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {runs.map((run) => (
                            <RunBadge key={run.id} run={run} reportType={def.type} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

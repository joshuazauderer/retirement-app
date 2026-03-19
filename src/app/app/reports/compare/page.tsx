'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ReportViewModel, ReportType } from '@/server/reports/types';
import { assembleComparisonReport } from '@/server/reports/reportComparisonService';

function CompareContent() {
  const searchParams = useSearchParams();
  const runA = searchParams.get('runA');
  const runB = searchParams.get('runB');
  const reportType = searchParams.get('reportType') as ReportType | null;

  const [viewModel, setViewModel] = useState<ReportViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runA || !runB || !reportType) {
      setError('Missing required parameters: runA, runB, and reportType.');
      setLoading(false);
      return;
    }

    const fetchBoth = async () => {
      try {
        const [resA, resB] = await Promise.all([
          fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportType, sourceRunId: runA }),
          }),
          fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportType, sourceRunId: runB }),
          }),
        ]);

        const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);

        if (dataA.error || dataB.error) {
          setError(dataA.error ?? dataB.error ?? 'Failed to load one or both reports.');
          return;
        }

        const comparison = await assembleComparisonReport(dataA.viewModel, dataB.viewModel);
        setViewModel(comparison);
      } catch {
        setError('Failed to load comparison report.');
      } finally {
        setLoading(false);
      }
    };

    fetchBoth();
  }, [runA, runB, reportType]);

  const handlePrint = () => window.print();

  if (loading) return <div className="p-8 text-slate-500">Loading comparison...</div>;
  if (error || !viewModel) return <div className="p-8 text-red-500">{error ?? 'Report not found.'}</div>;

  const { metadata, sections, comparisonRows, limitations } = viewModel;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          nav, .no-print, button { display: none !important; }
          body { font-size: 12pt; color: #000; background: #fff; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #999; padding: 4pt 8pt; font-size: 10pt; }
        }
      ` }} />

      <div className="space-y-6 max-w-5xl">
        {/* Action bar */}
        <div className="no-print flex items-center gap-3 pb-4 border-b border-slate-200">
          <a href="/app/reports" className="text-sm text-slate-500 hover:text-slate-700">
            ← Reports
          </a>
          <div className="flex-1" />
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 text-white text-sm rounded-md hover:bg-slate-700 transition-colors"
          >
            Print / Save PDF
          </button>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{metadata.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Generated: {new Date(metadata.generatedAt).toLocaleString()}
          </p>
        </div>

        {/* Section summaries */}
        <div className="grid grid-cols-2 gap-4">
          {sections.map((section, i) => (
            <div key={i} className="bg-slate-50 border border-slate-200 rounded-md p-4">
              <h3 className="font-semibold text-slate-800 mb-1">{section.title}</h3>
              <p className="text-sm text-slate-600">{section.content}</p>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        {comparisonRows && comparisonRows.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-3">Side-by-Side Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-md overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Metric</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Run A</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Run B</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-2 text-slate-600 font-medium">{row.label}</td>
                      <td className="px-4 py-2 text-slate-800">{row.a}</td>
                      <td className="px-4 py-2 text-slate-800">{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Limitations */}
        <div className="border-t border-slate-200 pt-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">Important Limitations</h2>
          <ul className="space-y-1">
            {limitations.map((lim, i) => (
              <li key={i} className="text-sm text-slate-500">• {lim}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}

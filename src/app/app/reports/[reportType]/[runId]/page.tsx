'use client';

import { useEffect, useState } from 'react';
import type { ReportViewModel, ReportType } from '@/server/reports/types';
import {
  formatReportDate,
  formatReportTimestamp,
} from '@/server/reports/reportRenderService';

interface PageParams {
  reportType: string;
  runId: string;
}

export default function ReportDetailPage({ params }: { params: PageParams }) {
  const { reportType, runId } = params;
  const [viewModel, setViewModel] = useState<ReportViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // HOUSEHOLD_SUMMARY uses "household" as placeholder runId
    const isHousehold = reportType === 'HOUSEHOLD_SUMMARY';

    const fetchReport = async () => {
      try {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportType: reportType as ReportType,
            ...(isHousehold ? {} : { sourceRunId: runId }),
          }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setViewModel(data.viewModel);
        }
      } catch {
        setError('Failed to load report.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportType, runId]);

  const handlePrint = () => {
    window.print();
  };

  const csvHref = `/api/reports/csv?reportType=${reportType}&runId=${runId}&dataType=yearByYear`;

  if (loading) {
    return (
      <div className="p-8 text-slate-500">Loading report...</div>
    );
  }

  if (error || !viewModel) {
    return (
      <div className="p-8 text-red-500">{error ?? 'Report not found.'}</div>
    );
  }

  const { metadata, assumptions, sections, summaryCards, yearByYearHeaders, yearByYearRows, comparisonRows, limitations } = viewModel;

  return (
    <>
      {/* Print styles injected inline */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          nav, .no-print, button { display: none !important; }
          body { font-size: 12pt; color: #000; background: #fff; }
          .print-page { page-break-after: always; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #999; padding: 4pt 8pt; font-size: 10pt; }
          .summary-card { border: 1px solid #999; padding: 8pt; margin: 4pt; display: inline-block; min-width: 120pt; }
        }
      ` }} />

      <div className="space-y-6 max-w-5xl">
        {/* Action bar */}
        <div className="no-print flex items-center gap-3 pb-4 border-b border-slate-200">
          <a
            href="/app/reports"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Reports
          </a>
          <div className="flex-1" />
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 text-white text-sm rounded-md hover:bg-slate-700 transition-colors"
          >
            Print / Save PDF
          </button>
          {viewModel.yearByYearRows && viewModel.yearByYearRows.length > 0 && (
            <a
              href={csvHref}
              download
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm rounded-md hover:bg-slate-50 transition-colors"
            >
              Download CSV
            </a>
          )}
        </div>

        {/* Report Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{metadata.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Generated: {formatReportTimestamp(metadata.generatedAt)}
          </p>
          {metadata.label && (
            <p className="text-sm text-slate-600 mt-0.5">Label: {metadata.label}</p>
          )}
        </div>

        {/* Assumptions Panel */}
        {(assumptions.scenarioName || assumptions.runDate || (assumptions.additionalNotes?.length ?? 0) > 0) && (
          <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">Assumptions</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {assumptions.scenarioName && (
                <>
                  <dt className="text-slate-500">Scenario</dt>
                  <dd className="text-slate-800">{assumptions.scenarioName}</dd>
                </>
              )}
              {assumptions.runDate && (
                <>
                  <dt className="text-slate-500">Run Date</dt>
                  <dd className="text-slate-800">{formatReportDate(assumptions.runDate)}</dd>
                </>
              )}
              {assumptions.inflationRate != null && (
                <>
                  <dt className="text-slate-500">Inflation Rate</dt>
                  <dd className="text-slate-800">{(assumptions.inflationRate * 100).toFixed(1)}%</dd>
                </>
              )}
              {assumptions.returnAssumption != null && (
                <>
                  <dt className="text-slate-500">Return Assumption</dt>
                  <dd className="text-slate-800">{(assumptions.returnAssumption * 100).toFixed(1)}%</dd>
                </>
              )}
            </dl>
            {assumptions.additionalNotes && assumptions.additionalNotes.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {assumptions.additionalNotes.map((note, i) => (
                  <li key={i} className="text-sm text-slate-600">• {note}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Summary Cards */}
        {summaryCards.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-3">Key Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {summaryCards.map((card, i) => (
                <div
                  key={i}
                  className="summary-card bg-white border border-slate-200 rounded-md p-4"
                >
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{card.label}</div>
                  <div className="text-lg font-bold text-slate-900">{card.value}</div>
                  {card.note && <div className="text-xs text-slate-400 mt-1">{card.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sections */}
        {sections.map((section, i) => (
          <div key={i}>
            <h2 className="text-base font-semibold text-slate-800 mb-1">{section.title}</h2>
            <p className="text-sm text-slate-600">{section.content}</p>
          </div>
        ))}

        {/* Comparison Table */}
        {comparisonRows && comparisonRows.length > 0 && (
          <div className="print-page">
            <h2 className="text-base font-semibold text-slate-800 mb-3">Side-by-Side Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-md overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Metric</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Plan A</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Plan B</th>
                    {comparisonRows.some((r) => r.delta) && (
                      <th className="text-left px-4 py-2 font-medium text-slate-700">Delta</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-2 text-slate-600 font-medium">{row.label}</td>
                      <td className="px-4 py-2 text-slate-800">{row.a}</td>
                      <td className="px-4 py-2 text-slate-800">{row.b}</td>
                      {comparisonRows.some((r) => r.delta) && (
                        <td className={`px-4 py-2 ${row.direction === 'better' ? 'text-green-600' : row.direction === 'worse' ? 'text-red-600' : 'text-slate-500'}`}>
                          {row.delta ?? '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Year-by-Year Table */}
        {yearByYearHeaders && yearByYearRows && yearByYearRows.length > 0 && (
          <div className="print-page">
            <div className="flex items-center justify-between mb-3 no-print">
              <h2 className="text-base font-semibold text-slate-800">Year-by-Year Detail</h2>
              <a
                href={csvHref}
                download
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Download CSV
              </a>
            </div>
            <h2 className="text-base font-semibold text-slate-800 mb-3 hidden print:block">Year-by-Year Detail</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    {yearByYearHeaders.map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yearByYearRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {yearByYearHeaders.map((h) => (
                        <td key={h} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{String(row[h] ?? '—')}</td>
                      ))}
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

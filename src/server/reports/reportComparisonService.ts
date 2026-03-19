/**
 * reportComparisonService — assemble comparison report view models.
 */
import type { ReportViewModel } from './types';

export async function assembleComparisonReport(
  viewModelA: ReportViewModel,
  viewModelB: ReportViewModel,
): Promise<ReportViewModel> {
  // Build comparison rows from summaryCards
  const mapA = new Map(viewModelA.summaryCards.map((c) => [c.label, c.value]));
  const mapB = new Map(viewModelB.summaryCards.map((c) => [c.label, c.value]));
  const allLabels = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));

  const comparisonRows = allLabels.map((label) => ({
    label,
    a: mapA.get(label) ?? '—',
    b: mapB.get(label) ?? '—',
  }));

  return {
    metadata: {
      ...viewModelA.metadata,
      reportType: 'SCENARIO_COMPARISON',
      title: `Comparison: ${viewModelA.metadata.label ?? 'Run A'} vs ${viewModelB.metadata.label ?? 'Run B'}`,
      secondaryRunId: viewModelB.metadata.sourceRunId,
    },
    assumptions: viewModelA.assumptions,
    sections: [
      {
        title: 'Run A',
        content: viewModelA.sections[0]?.content ?? '',
      },
      {
        title: 'Run B',
        content: viewModelB.sections[0]?.content ?? '',
      },
    ],
    summaryCards: viewModelA.summaryCards,
    comparisonRows,
    limitations: viewModelA.limitations,
  };
}

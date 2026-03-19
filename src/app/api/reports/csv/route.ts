/**
 * GET /api/reports/csv
 * Query params: householdId, reportType, runId, dataType (yearByYear | summary | comparison)
 * Returns: text/csv download
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  assembleTaxPlanningReport,
  assembleHealthcareLongevityReport,
  assembleHousingLegacyReport,
  assembleMonteCarloReport,
} from '@/server/reports/reportDataAssemblyService';
import {
  generateYearByYearCsv,
  generateSummaryCardsCsv,
  generateComparisonCsv,
} from '@/server/reports/csvExportService';
import type { ReportType } from '@/server/reports/types';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) {
    return NextResponse.json({ error: 'No household found.' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const reportType = searchParams.get('reportType') as ReportType | null;
  const runId = searchParams.get('runId');
  const dataType = searchParams.get('dataType') ?? 'yearByYear'; // yearByYear | summary | comparison

  if (!reportType) {
    return NextResponse.json({ error: 'reportType is required.' }, { status: 400 });
  }

  try {
    let viewModel;
    const baseFilename = `${reportType.toLowerCase()}-${runId ?? 'report'}`;

    switch (reportType) {
      case 'TAX_PLANNING':
        if (!runId) return NextResponse.json({ error: 'runId required.' }, { status: 400 });
        viewModel = await assembleTaxPlanningReport(runId, householdId);
        break;
      case 'HEALTHCARE_LONGEVITY':
        if (!runId) return NextResponse.json({ error: 'runId required.' }, { status: 400 });
        viewModel = await assembleHealthcareLongevityReport(runId, householdId);
        break;
      case 'HOUSING_LEGACY':
        if (!runId) return NextResponse.json({ error: 'runId required.' }, { status: 400 });
        viewModel = await assembleHousingLegacyReport(runId, householdId);
        break;
      case 'MONTE_CARLO_SUMMARY':
        if (!runId) return NextResponse.json({ error: 'runId required.' }, { status: 400 });
        viewModel = await assembleMonteCarloReport(runId, householdId);
        break;
      default:
        return NextResponse.json(
          { error: `CSV export not supported for '${reportType}'.` },
          { status: 400 },
        );
    }

    let csvResult;
    if (dataType === 'summary') {
      csvResult = generateSummaryCardsCsv(viewModel, `${baseFilename}-summary`);
    } else if (dataType === 'comparison') {
      csvResult = generateComparisonCsv(viewModel, `${baseFilename}-comparison`);
    } else {
      csvResult = generateYearByYearCsv(viewModel, `${baseFilename}-yearly`);
    }

    return new Response(csvResult.content, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${csvResult.filename}"`,
      },
    });
  } catch (err) {
    console.error('[reports/csv GET]', err);
    return NextResponse.json({ error: 'Failed to generate CSV.' }, { status: 500 });
  }
}

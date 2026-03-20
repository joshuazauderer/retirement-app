/**
 * GET  /api/reports  — List available report sources for the household
 * POST /api/reports  — Generate a report view model (returns ReportViewModel)
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listReportDefinitions } from '@/server/reports/reportDefinitionService';
import { requireFeature } from '@/server/billing/featureGateService';
import {
  validateReportRequest,
  assembleHouseholdSummaryReport,
  assembleTaxPlanningReport,
  assembleHealthcareLongevityReport,
  assembleHousingLegacyReport,
  assembleMonteCarloReport,
} from '@/server/reports/reportDataAssemblyService';
import type { ReportRequest, ReportType } from '@/server/reports/types';

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

  try {
    // Return report definitions + recent runs for each reportable type
    const definitions = listReportDefinitions();

    const [taxRuns, healthcareRuns, housingRuns, monteCarloRuns] = await Promise.all([
      prisma.taxPlanningRun.findMany({
        where: { householdId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, label: true, createdAt: true, success: true, scenario: { select: { name: true } } },
      }),
      prisma.healthcarePlanningRun.findMany({
        where: { householdId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, label: true, createdAt: true, success: true, scenario: { select: { name: true } } },
      }),
      prisma.housingPlanningRun.findMany({
        where: { householdId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, label: true, strategy: true, createdAt: true, success: true, scenario: { select: { name: true } } },
      }),
      prisma.monteCarloRun.findMany({
        where: { householdId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, label: true, createdAt: true, simulationCount: true, scenario: { select: { name: true } } },
      }),
    ]);

    return NextResponse.json({
      householdId,
      definitions,
      recentRuns: {
        TAX_PLANNING: taxRuns,
        HEALTHCARE_LONGEVITY: healthcareRuns,
        HOUSING_LEGACY: housingRuns,
        MONTE_CARLO_SUMMARY: monteCarloRuns,
      },
    });
  } catch (err) {
    console.error('[reports GET]', err);
    return NextResponse.json({ error: 'Failed to load report data.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Feature gate — reports_export requires PRO or ADVISOR plan
  try {
    await requireFeature(session.user.id, 'reports_export');
  } catch (err) {
    if (err instanceof Error && err.message === 'FEATURE_GATED') {
      return NextResponse.json(
        { error: 'Report generation requires a Pro subscription.', upgradeRequired: true, upgradeUrl: '/app/settings/billing' },
        { status: 402 }
      );
    }
    throw err;
  }

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) {
    return NextResponse.json({ error: 'No household found.' }, { status: 404 });
  }

  let body: ReportRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { reportType, sourceRunId } = body;

  const validation = await validateReportRequest(
    reportType as ReportType,
    householdId,
    sourceRunId,
    session.user.id,
  );
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join('; ') }, { status: 400 });
  }

  try {
    let viewModel;

    switch (reportType) {
      case 'HOUSEHOLD_SUMMARY':
        viewModel = await assembleHouseholdSummaryReport(householdId);
        break;
      case 'TAX_PLANNING':
        viewModel = await assembleTaxPlanningReport(sourceRunId!, householdId);
        break;
      case 'HEALTHCARE_LONGEVITY':
        viewModel = await assembleHealthcareLongevityReport(sourceRunId!, householdId);
        break;
      case 'HOUSING_LEGACY':
        viewModel = await assembleHousingLegacyReport(sourceRunId!, householdId);
        break;
      case 'MONTE_CARLO_SUMMARY':
        viewModel = await assembleMonteCarloReport(sourceRunId!, householdId);
        break;
      default:
        return NextResponse.json(
          { error: `Report type '${reportType}' not yet implemented.` },
          { status: 400 },
        );
    }

    return NextResponse.json({ viewModel });
  } catch (err) {
    console.error('[reports POST]', err);
    return NextResponse.json({ error: 'Failed to generate report.' }, { status: 500 });
  }
}

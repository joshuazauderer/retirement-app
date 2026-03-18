import { NextRequest, NextResponse } from 'next/server';
import { requireHousehold } from '@/lib/getHousehold';
import { scenarioRunService } from '@/server/scenarios/scenarioRunService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ scenarioId: string }> }) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  const { scenarioId } = await params;
  try {
    const result = await scenarioRunService.runScenario(scenarioId, hr.household.id);
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

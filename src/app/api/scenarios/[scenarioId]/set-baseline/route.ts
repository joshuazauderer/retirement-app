import { NextRequest, NextResponse } from 'next/server';
import { requireHousehold } from '@/lib/getHousehold';
import { scenarioService } from '@/server/scenarios/scenarioService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ scenarioId: string }> }) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  const { scenarioId } = await params;
  try {
    const scenario = await scenarioService.setBaseline(scenarioId, hr.household.id);
    return NextResponse.json({ scenario });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

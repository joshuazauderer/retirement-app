import { NextRequest, NextResponse } from 'next/server';
import { requireHousehold } from '@/lib/getHousehold';
import { scenarioService } from '@/server/scenarios/scenarioService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ scenarioId: string }> }) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  const { scenarioId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const scenario = await scenarioService.duplicate(scenarioId, hr.household.id, body.name);
    return NextResponse.json({ scenario }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireHousehold } from '@/lib/getHousehold';
import { scenarioService } from '@/server/scenarios/scenarioService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ scenarioId: string }> }) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  const { scenarioId } = await params;
  const scenario = await scenarioService.getById(scenarioId, hr.household.id);
  if (!scenario) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ scenario });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ scenarioId: string }> }) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  const { scenarioId } = await params;
  try {
    const body = await req.json();
    const scenario = await scenarioService.update(scenarioId, hr.household.id, body);
    return NextResponse.json({ scenario });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ scenarioId: string }> }) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  const { scenarioId } = await params;
  try {
    await scenarioService.archive(scenarioId, hr.household.id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

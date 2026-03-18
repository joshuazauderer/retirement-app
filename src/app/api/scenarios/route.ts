import { NextRequest, NextResponse } from 'next/server';
import { requireHousehold } from '@/lib/getHousehold';
import { scenarioService } from '@/server/scenarios/scenarioService';

export async function GET() {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  try {
    // Ensure baseline exists before listing
    await scenarioService.ensureBaseline(hr.household.id);
    const scenarios = await scenarioService.listForHousehold(hr.household.id);
    return NextResponse.json({ scenarios });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  try {
    const body = await req.json();
    const scenario = await scenarioService.create(hr.household.id, body);
    return NextResponse.json({ scenario }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

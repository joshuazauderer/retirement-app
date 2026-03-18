import { NextRequest, NextResponse } from 'next/server';
import { requireHousehold } from '@/lib/getHousehold';
import { scenarioComparisonService } from '@/server/scenarios/scenarioComparisonService';

export async function GET(req: NextRequest) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  const a = req.nextUrl.searchParams.get('a');
  const b = req.nextUrl.searchParams.get('b');
  if (!a || !b) return NextResponse.json({ error: 'Must provide ?a=scenarioId&b=scenarioId' }, { status: 400 });
  try {
    const comparison = await scenarioComparisonService.compare(a, b, hr.household.id);
    return NextResponse.json({ comparison });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

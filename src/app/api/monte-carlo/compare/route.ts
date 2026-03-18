import { NextRequest, NextResponse } from 'next/server';
import { requireHousehold } from '@/lib/getHousehold';
import { compareMonteCarloRuns } from '@/server/monteCarlo/monteCarloComparisonService';

export async function GET(req: NextRequest) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  const { searchParams } = new URL(req.url);
  const runIdA = searchParams.get('a');
  const runIdB = searchParams.get('b');
  if (!runIdA || !runIdB) {
    return NextResponse.json({ error: 'Both ?a= and ?b= run IDs are required.' }, { status: 400 });
  }
  if (runIdA === runIdB) {
    return NextResponse.json({ error: 'Run IDs must be different.' }, { status: 400 });
  }
  try {
    const comparison = await compareMonteCarloRuns(runIdA, runIdB, hr.household.id);
    return NextResponse.json({ comparison });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

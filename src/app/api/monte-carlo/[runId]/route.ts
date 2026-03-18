import { NextRequest, NextResponse } from 'next/server';
import { requireHousehold } from '@/lib/getHousehold';
import { monteCarloRunService } from '@/server/monteCarlo/monteCarloRunService';

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  try {
    const run = await monteCarloRunService.getById(params.runId, hr.household.id);
    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ run });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

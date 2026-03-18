import { NextRequest, NextResponse } from 'next/server';
import { requireHousehold } from '@/lib/getHousehold';
import { monteCarloRunService } from '@/server/monteCarlo/monteCarloRunService';
import { validateMonteCarloInput } from '@/server/monteCarlo/monteCarloInputService';
import type { MonteCarloRunInput } from '@/server/monteCarlo/types';

export async function GET() {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  try {
    const runs = await monteCarloRunService.listForHousehold(hr.household.id);
    return NextResponse.json({ runs });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  try {
    const body = await req.json();
    const input: MonteCarloRunInput = {
      householdId: hr.household.id,
      scenarioId: body.scenarioId,
      simulationCount: body.simulationCount,
      seed: body.seed,
      meanReturnOverride: body.meanReturnOverride,
      volatilityOverride: body.volatilityOverride,
    };

    const validation = validateMonteCarloInput(input);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join('; ') }, { status: 422 });
    }

    const result = await monteCarloRunService.run(input);
    return NextResponse.json({ run: result }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

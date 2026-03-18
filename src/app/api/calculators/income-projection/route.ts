import { NextResponse } from 'next/server';
import { requireHousehold } from '@/lib/getHousehold';
import { calculatorService } from '@/server/calculators/calculatorService';

export async function GET() {
  const hr = await requireHousehold();
  if ('error' in hr) return hr.error;
  try {
    const data = await calculatorService.getIncomeProjection(hr.household.id);
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

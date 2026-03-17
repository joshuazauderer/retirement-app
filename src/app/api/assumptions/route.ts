import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  getPlanningAssumptions,
  upsertPlanningAssumptions,
} from "@/server/services/planningAssumptionService";
import { planningAssumptionsSchema } from "@/lib/validations/financial";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const assumptions = await getPlanningAssumptions(result.household.id);
  return NextResponse.json({ assumptions });
}

export async function POST(req: NextRequest) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const body = await req.json();
  const parsed = planningAssumptionsSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const d = parsed.data;
  const assumptions = await upsertPlanningAssumptions(result.household.id, {
    inflationRate: d.inflationRate,
    expectedPortfolioReturn: d.expectedPortfolioReturn,
    expectedPortfolioVolatility: d.expectedPortfolioVolatility,
    defaultRetirementAgeOverride: d.defaultRetirementAgeOverride,
    longevityTargetPrimary: d.longevityTargetPrimary,
    longevityTargetSpouse: d.longevityTargetSpouse,
    assumedTaxRate: d.assumedTaxRate,
    simulationCountDefault: d.simulationCountDefault,
    notes: d.notes,
  });
  return NextResponse.json({ assumptions });
}

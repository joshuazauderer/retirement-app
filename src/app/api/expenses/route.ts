import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  getExpenseProfile,
  upsertExpenseProfile,
} from "@/server/services/expenseService";
import { expenseProfileSchema } from "@/lib/validations/financial";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const profile = await getExpenseProfile(result.household.id);
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const body = await req.json();
  const parsed = expenseProfileSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const d = parsed.data;
  const profile = await upsertExpenseProfile(result.household.id, {
    currentMonthlySpending: d.currentMonthlySpending,
    retirementMonthlyEssential: d.retirementMonthlyEssential,
    retirementMonthlyDiscretionary: d.retirementMonthlyDiscretionary,
    healthcareMonthlyEstimate: d.healthcareMonthlyEstimate,
    housingMonthlyEstimate: d.housingMonthlyEstimate,
    travelMonthlyEstimate: d.travelMonthlyEstimate || undefined,
    otherMonthlyEstimate: d.otherMonthlyEstimate || undefined,
    inflationAssumption: d.inflationAssumption || undefined,
    notes: d.notes,
  });
  return NextResponse.json({ profile });
}

import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  listBenefitSources,
  createBenefitSource,
} from "@/server/services/benefitService";
import { benefitSourceSchema } from "@/lib/validations/financial";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const sources = await listBenefitSources(result.household.id);
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const body = await req.json();
  const parsed = benefitSourceSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const d = parsed.data;
  const source = await createBenefitSource(result.household.id, {
    householdMemberId: d.householdMemberId,
    type: d.type,
    label: d.label,
    estimatedMonthlyBenefit: d.estimatedMonthlyBenefit,
    claimAge: d.claimAge,
    startDate: d.startDate ? new Date(d.startDate) : undefined,
    colaRate: d.colaRate || undefined,
    survivorEligible: d.survivorEligible,
    notes: d.notes,
    isActive: d.isActive,
    householdId: result.household.id,
  });
  return NextResponse.json({ source }, { status: 201 });
}

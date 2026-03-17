import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import { listIncomeSources, createIncomeSource } from "@/server/services/incomeService";
import { incomeSourceSchema } from "@/lib/validations/financial";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const sources = await listIncomeSources(result.household.id);
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const body = await req.json();
  const parsed = incomeSourceSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const d = parsed.data;
  const source = await createIncomeSource(result.household.id, {
    householdMemberId: d.householdMemberId,
    type: d.type,
    label: d.label,
    amount: d.amount,
    frequency: d.frequency,
    startDate: d.startDate ? new Date(d.startDate) : undefined,
    endDate: d.endDate ? new Date(d.endDate) : undefined,
    annualGrowthRate: d.annualGrowthRate || undefined,
    taxable: d.taxable,
    notes: d.notes,
    isActive: d.isActive,
    householdId: result.household.id,
  });
  return NextResponse.json({ source }, { status: 201 });
}

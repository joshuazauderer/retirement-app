import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  listLiabilities,
  createLiability,
} from "@/server/services/liabilityService";
import { liabilitySchema } from "@/lib/validations/financial";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const liabilities = await listLiabilities(result.household.id);
  return NextResponse.json({ liabilities });
}

export async function POST(req: NextRequest) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const body = await req.json();
  const parsed = liabilitySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const d = parsed.data;
  const liability = await createLiability(result.household.id, {
    householdMemberId: d.householdMemberId || undefined,
    type: d.type,
    label: d.label,
    lenderName: d.lenderName,
    currentBalance: d.currentBalance,
    interestRate: d.interestRate || undefined,
    monthlyPayment: d.monthlyPayment || undefined,
    payoffDate: d.payoffDate ? new Date(d.payoffDate) : undefined,
    isSecured: d.isSecured,
    notes: d.notes,
    isActive: d.isActive,
    householdId: result.household.id,
  });
  return NextResponse.json({ liability }, { status: 201 });
}

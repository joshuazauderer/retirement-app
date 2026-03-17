import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  getInsuranceProfile,
  upsertInsuranceProfile,
} from "@/server/services/insuranceService";
import { insuranceProfileSchema } from "@/lib/validations/financial";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const profile = await getInsuranceProfile(result.household.id);
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const body = await req.json();
  const parsed = insuranceProfileSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const d = parsed.data;
  const profile = await upsertInsuranceProfile(result.household.id, {
    healthInsuranceStatus: d.healthInsuranceStatus,
    longTermCareCoverage: d.longTermCareCoverage,
    lifeInsuranceCoverageAmount: d.lifeInsuranceCoverageAmount || undefined,
    lifeInsuranceNotes: d.lifeInsuranceNotes,
    disabilityCoverageFlag: d.disabilityCoverageFlag,
    umbrellaCoverageFlag: d.umbrellaCoverageFlag,
    notes: d.notes,
  });
  return NextResponse.json({ profile });
}

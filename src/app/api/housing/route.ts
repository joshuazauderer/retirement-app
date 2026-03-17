import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  listRealEstateProperties,
  createRealEstateProperty,
} from "@/server/services/realEstateService";
import { realEstatePropertySchema } from "@/lib/validations/financial";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const properties = await listRealEstateProperties(result.household.id);
  return NextResponse.json({ properties });
}

export async function POST(req: NextRequest) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const body = await req.json();
  const parsed = realEstatePropertySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const d = parsed.data;
  const property = await createRealEstateProperty(result.household.id, {
    type: d.type,
    label: d.label,
    ownershipType: d.ownershipType,
    currentMarketValue: d.currentMarketValue,
    mortgageBalance: d.mortgageBalance || undefined,
    monthlyMortgagePayment: d.monthlyMortgagePayment || undefined,
    annualPropertyTax: d.annualPropertyTax || undefined,
    annualInsuranceCost: d.annualInsuranceCost || undefined,
    annualMaintenanceEstimate: d.annualMaintenanceEstimate || undefined,
    isPrimaryResidence: d.isPrimaryResidence,
    downsizingCandidate: d.downsizingCandidate,
    expectedSaleYear: d.expectedSaleYear,
    notes: d.notes,
  });
  return NextResponse.json({ property }, { status: 201 });
}

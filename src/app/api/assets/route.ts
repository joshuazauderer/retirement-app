import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  listAssetAccounts,
  createAssetAccount,
} from "@/server/services/assetService";
import { assetAccountSchema } from "@/lib/validations/financial";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const accounts = await listAssetAccounts(result.household.id);
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const body = await req.json();
  const parsed = assetAccountSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const d = parsed.data;
  const account = await createAssetAccount(result.household.id, {
    householdMemberId: d.householdMemberId || undefined,
    ownerType: d.ownerType,
    type: d.type,
    institutionName: d.institutionName,
    accountName: d.accountName,
    currentBalance: d.currentBalance,
    annualContributionAmount: d.annualContributionAmount || undefined,
    contributionFrequency: d.contributionFrequency,
    employerMatchAmount: d.employerMatchAmount || undefined,
    employerMatchPercent: d.employerMatchPercent || undefined,
    taxTreatment: d.taxTreatment,
    expectedReturnRate: d.expectedReturnRate || undefined,
    notes: d.notes,
    isActive: d.isActive,
    householdId: result.household.id,
  });
  return NextResponse.json({ account }, { status: 201 });
}

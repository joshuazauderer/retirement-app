import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  updateAssetAccount,
  deleteAssetAccount,
} from "@/server/services/assetService";
import { assetAccountSchema } from "@/lib/validations/financial";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const { id } = await params;
  const body = await req.json();
  const parsed = assetAccountSchema.partial().safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const account = await updateAssetAccount(
    result.household.id,
    id,
    parsed.data as Parameters<typeof updateAssetAccount>[2]
  );
  return NextResponse.json({ account });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const { id } = await params;
  await deleteAssetAccount(result.household.id, id);
  return NextResponse.json({ success: true });
}

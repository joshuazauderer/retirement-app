import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  updateRealEstateProperty,
  deleteRealEstateProperty,
} from "@/server/services/realEstateService";
import { realEstatePropertySchema } from "@/lib/validations/financial";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const { id } = await params;
  const body = await req.json();
  const parsed = realEstatePropertySchema.partial().safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const property = await updateRealEstateProperty(
    result.household.id,
    id,
    parsed.data as Parameters<typeof updateRealEstateProperty>[2]
  );
  return NextResponse.json({ property });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const { id } = await params;
  await deleteRealEstateProperty(result.household.id, id);
  return NextResponse.json({ success: true });
}

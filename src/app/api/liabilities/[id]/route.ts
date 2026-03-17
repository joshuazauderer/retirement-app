import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  updateLiability,
  deleteLiability,
} from "@/server/services/liabilityService";
import { liabilitySchema } from "@/lib/validations/financial";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const { id } = await params;
  const body = await req.json();
  const parsed = liabilitySchema.partial().safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const liability = await updateLiability(
    result.household.id,
    id,
    parsed.data as Parameters<typeof updateLiability>[2]
  );
  return NextResponse.json({ liability });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const { id } = await params;
  await deleteLiability(result.household.id, id);
  return NextResponse.json({ success: true });
}

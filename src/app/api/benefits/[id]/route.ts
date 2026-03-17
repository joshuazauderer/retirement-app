import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import {
  updateBenefitSource,
  deleteBenefitSource,
} from "@/server/services/benefitService";
import { benefitSourceSchema } from "@/lib/validations/financial";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const { id } = await params;
  const body = await req.json();
  const parsed = benefitSourceSchema.partial().safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  const source = await updateBenefitSource(
    result.household.id,
    id,
    parsed.data as Parameters<typeof updateBenefitSource>[2]
  );
  return NextResponse.json({ source });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const { id } = await params;
  await deleteBenefitSource(result.household.id, id);
  return NextResponse.json({ success: true });
}

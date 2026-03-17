import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { householdService, HouseholdServiceError } from "@/services/householdService";
import { requireHousehold } from "@/lib/getHousehold";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  return NextResponse.json({ members: result.members });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { householdId, ...memberData } = body;

    if (!householdId) {
      return NextResponse.json({ error: "householdId is required" }, { status: 400 });
    }

    const member = await householdService.addMember(householdId, session.user.id, memberData);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof HouseholdServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { householdService, HouseholdServiceError } from "@/services/householdService";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const household = await householdService.getHouseholdByUserId(session.user.id);
  return NextResponse.json({ household });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const household = await householdService.createHousehold(session.user.id, body);
    return NextResponse.json({ household }, { status: 201 });
  } catch (error) {
    if (error instanceof HouseholdServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

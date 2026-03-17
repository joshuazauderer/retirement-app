import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function requireHousehold() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const household = await prisma.household.findUnique({
    where: { primaryUserId: session.user.id },
    include: { members: true },
  });
  if (!household) {
    return { error: NextResponse.json({ error: "Household not found" }, { status: 404 }) };
  }
  return { household, members: household.members };
}

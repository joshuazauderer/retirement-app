import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import { getHouseholdOverview } from "@/server/services/overviewService";
import { getProfileCompletion } from "@/server/services/profileCompletionService";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const [overview, completion] = await Promise.all([
    getHouseholdOverview(result.household.id),
    getProfileCompletion(result.household.id),
  ]);
  return NextResponse.json({ overview, completion });
}

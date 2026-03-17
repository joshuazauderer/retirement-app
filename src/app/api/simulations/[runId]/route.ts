import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import { simulationService } from "@/server/services/simulationService";

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const run = await simulationService.getRunById(
    params.runId,
    result.household.id
  );
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ run });
}

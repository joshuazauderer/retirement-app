import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import { simulationService } from "@/server/services/simulationService";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  const runs = await simulationService.getRunsForHousehold(result.household.id);
  return NextResponse.json({ runs });
}

export async function POST() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  try {
    const { runId } = await simulationService.runAndPersist(result.household.id);
    return NextResponse.json({ runId }, { status: 201 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

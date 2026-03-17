import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/getHousehold";
import { buildSimulationSnapshot } from "@/server/simulation/buildSimulationSnapshot";
import { validateSimulationInputs } from "@/server/simulation/validateSimulationInputs";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireHousehold();
  if ("error" in result) return result.error;
  try {
    const snapshot = await buildSimulationSnapshot(result.household.id, prisma);
    const validation = validateSimulationInputs(snapshot);
    return NextResponse.json({
      validation,
      snapshot: {
        timeline: snapshot.timeline,
        members: snapshot.members,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to validate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

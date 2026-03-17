-- Phase 3: Add SimulationRun model

CREATE TABLE "simulation_runs" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "runType" TEXT NOT NULL DEFAULT 'deterministic',
    "label" TEXT,
    "snapshotJson" JSONB NOT NULL,
    "outputJson" JSONB NOT NULL,
    "success" BOOLEAN NOT NULL,
    "firstDepletionYear" INTEGER,
    "endingBalance" DECIMAL(18,2) NOT NULL,
    "endingNetWorth" DECIMAL(18,2) NOT NULL,
    "totalWithdrawals" DECIMAL(18,2) NOT NULL,
    "totalTaxes" DECIMAL(18,2) NOT NULL,
    "projectionStartYear" INTEGER NOT NULL,
    "projectionEndYear" INTEGER NOT NULL,
    "yearsProjected" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "simulation_runs_householdId_idx" ON "simulation_runs"("householdId");

ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

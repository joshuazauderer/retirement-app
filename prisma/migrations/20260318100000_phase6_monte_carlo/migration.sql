-- Phase 6: Monte Carlo Simulation Engine
-- Creates monte_carlo_runs table and adds the back-relation on scenarios

CREATE TABLE "monte_carlo_runs" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "label" TEXT,
    "seed" INTEGER NOT NULL,
    "simulationCount" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "assumptionsJson" JSONB NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "aggregationJson" JSONB NOT NULL,
    "successProbability" DECIMAL(5,4) NOT NULL,
    "failureProbability" DECIMAL(5,4) NOT NULL,
    "medianEndingAssets" DECIMAL(18,2) NOT NULL,
    "p10EndingAssets" DECIMAL(18,2) NOT NULL,
    "p90EndingAssets" DECIMAL(18,2) NOT NULL,
    "medianDepletionYear" INTEGER,
    "projectionStartYear" INTEGER NOT NULL,
    "projectionEndYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monte_carlo_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "monte_carlo_runs_householdId_idx" ON "monte_carlo_runs"("householdId");

ALTER TABLE "monte_carlo_runs" ADD CONSTRAINT "monte_carlo_runs_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monte_carlo_runs" ADD CONSTRAINT "monte_carlo_runs_scenarioId_fkey"
    FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

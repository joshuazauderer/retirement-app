-- Phase 5: Scenario Builder + Plan Comparison

-- Create scenarios table
CREATE TABLE IF NOT EXISTS "scenarios" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scenarioType" TEXT NOT NULL DEFAULT 'CUSTOM',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "overridesJson" JSONB,
    "sourceScenarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- Index on householdId for fast lookups
CREATE INDEX IF NOT EXISTS "scenarios_householdId_idx" ON "scenarios"("householdId");

-- FK: scenarios -> households
ALTER TABLE "scenarios" DROP CONSTRAINT IF EXISTS "scenarios_householdId_fkey";
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add scenarioId column to simulation_runs (nullable FK to scenarios)
ALTER TABLE "simulation_runs" ADD COLUMN IF NOT EXISTS "scenarioId" TEXT;

-- FK: simulation_runs -> scenarios
ALTER TABLE "simulation_runs" DROP CONSTRAINT IF EXISTS "simulation_runs_scenarioId_fkey";
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_scenarioId_fkey"
    FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

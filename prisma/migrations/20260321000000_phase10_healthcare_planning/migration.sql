CREATE TABLE "healthcare_planning_runs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "householdId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "label" TEXT NOT NULL,
    "healthcareConfigJson" JSONB NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "yearlyJson" JSONB NOT NULL,
    "totalHealthcareCost" DOUBLE PRECISION NOT NULL,
    "endingAssets" DOUBLE PRECISION NOT NULL,
    "success" BOOLEAN NOT NULL,
    "firstDepletionYear" INTEGER,
    "hasLtcStress" BOOLEAN NOT NULL DEFAULT false,
    "hasLongevityStress" BOOLEAN NOT NULL DEFAULT false,
    "longevityTargetAge" INTEGER,
    "projectionStartYear" INTEGER NOT NULL,
    "projectionEndYear" INTEGER NOT NULL,
    CONSTRAINT "healthcare_planning_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "healthcare_planning_runs_householdId_idx" ON "healthcare_planning_runs"("householdId");
CREATE INDEX "healthcare_planning_runs_scenarioId_idx" ON "healthcare_planning_runs"("scenarioId");

ALTER TABLE "healthcare_planning_runs" ADD CONSTRAINT "healthcare_planning_runs_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "healthcare_planning_runs" ADD CONSTRAINT "healthcare_planning_runs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

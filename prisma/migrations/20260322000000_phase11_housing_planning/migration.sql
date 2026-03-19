-- CreateTable
CREATE TABLE "housing_planning_runs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "householdId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "label" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "housingConfigJson" JSONB NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "yearlyJson" JSONB NOT NULL,
    "equityReleaseJson" JSONB,
    "legacyJson" JSONB,
    "netReleasedEquity" DOUBLE PRECISION NOT NULL,
    "endingFinancialAssets" DOUBLE PRECISION NOT NULL,
    "projectedNetEstate" DOUBLE PRECISION NOT NULL,
    "success" BOOLEAN NOT NULL,
    "firstDepletionYear" INTEGER,
    "hasDownsizing" BOOLEAN NOT NULL DEFAULT false,
    "hasRelocation" BOOLEAN NOT NULL DEFAULT false,
    "projectionStartYear" INTEGER NOT NULL,
    "projectionEndYear" INTEGER NOT NULL,
    CONSTRAINT "housing_planning_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "housing_planning_runs_householdId_idx" ON "housing_planning_runs"("householdId");

-- CreateIndex
CREATE INDEX "housing_planning_runs_scenarioId_idx" ON "housing_planning_runs"("scenarioId");

-- AddForeignKey
ALTER TABLE "housing_planning_runs" ADD CONSTRAINT "housing_planning_runs_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housing_planning_runs" ADD CONSTRAINT "housing_planning_runs_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

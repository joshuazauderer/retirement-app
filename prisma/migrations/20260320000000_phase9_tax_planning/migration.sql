-- Phase 9: Tax Planning Layer
-- Creates the tax_planning_runs table for storing tax-aware projection results.

CREATE TABLE "tax_planning_runs" (
    "id"                  TEXT NOT NULL,
    "householdId"         TEXT NOT NULL,
    "scenarioId"          TEXT,
    "label"               TEXT,
    "taxConfigJson"       JSONB NOT NULL,
    "snapshotJson"        JSONB NOT NULL,
    "summaryJson"         JSONB NOT NULL,
    "yearlyJson"          JSONB NOT NULL,
    "totalFederalTax"     DECIMAL(18,2) NOT NULL,
    "totalStateTax"       DECIMAL(18,2) NOT NULL,
    "totalLifetimeTax"    DECIMAL(18,2) NOT NULL,
    "firstDepletionYear"  INTEGER,
    "success"             BOOLEAN NOT NULL,
    "projectionStartYear" INTEGER NOT NULL,
    "projectionEndYear"   INTEGER NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_planning_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_planning_runs_householdId_idx" ON "tax_planning_runs"("householdId");

ALTER TABLE "tax_planning_runs"
    ADD CONSTRAINT "tax_planning_runs_householdId_fkey"
    FOREIGN KEY ("householdId")
    REFERENCES "households"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tax_planning_runs"
    ADD CONSTRAINT "tax_planning_runs_scenarioId_fkey"
    FOREIGN KEY ("scenarioId")
    REFERENCES "scenarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

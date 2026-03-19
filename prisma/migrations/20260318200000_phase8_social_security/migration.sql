-- Phase 8: Social Security Modeling + Couple Coordination + Survivor Income
-- Adds the SocialSecurityRun table for persisting SS planning analysis results.

CREATE TABLE "social_security_runs" (
    "id"                   TEXT NOT NULL,
    "householdId"          TEXT NOT NULL,
    "scenarioId"           TEXT,
    "label"                TEXT,
    "inputJson"            JSONB NOT NULL,
    "resultJson"           JSONB NOT NULL,
    "totalLifetimeBenefit" DECIMAL(18,2) NOT NULL,
    "breakEvenAge"         INTEGER,
    "projectionStartYear"  INTEGER NOT NULL,
    "projectionEndYear"    INTEGER NOT NULL,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_security_runs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "social_security_runs_householdId_idx" ON "social_security_runs"("householdId");

-- Foreign keys
ALTER TABLE "social_security_runs"
    ADD CONSTRAINT "social_security_runs_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_security_runs"
    ADD CONSTRAINT "social_security_runs_scenarioId_fkey"
    FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

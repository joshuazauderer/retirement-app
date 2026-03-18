-- Phase 7: Withdrawal Strategy Engine + Sequence Risk Analysis
-- Creates the withdrawal_strategy_runs table.
-- Migration-safe: additive only, no existing schema changes.

CREATE TABLE "withdrawal_strategy_runs" (
    "id"                  TEXT         NOT NULL,
    "householdId"         TEXT         NOT NULL,
    "scenarioId"          TEXT,
    "label"               TEXT,
    "strategyType"        TEXT         NOT NULL,
    "orderingType"        TEXT         NOT NULL,
    "configJson"          JSONB        NOT NULL,
    "snapshotJson"        JSONB        NOT NULL,
    "summaryJson"         JSONB        NOT NULL,
    "yearlyJson"          JSONB        NOT NULL,
    "success"             BOOLEAN      NOT NULL,
    "firstDepletionYear"  INTEGER,
    "endingAssets"        DECIMAL(18,2) NOT NULL,
    "totalWithdrawals"    DECIMAL(18,2) NOT NULL,
    "totalTaxes"          DECIMAL(18,2) NOT NULL,
    "isStressRun"         BOOLEAN      NOT NULL DEFAULT false,
    "stressPathId"        TEXT,
    "projectionStartYear" INTEGER      NOT NULL,
    "projectionEndYear"   INTEGER      NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_strategy_runs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "withdrawal_strategy_runs_householdId_idx" ON "withdrawal_strategy_runs"("householdId");

-- Foreign keys
ALTER TABLE "withdrawal_strategy_runs"
    ADD CONSTRAINT "withdrawal_strategy_runs_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "withdrawal_strategy_runs"
    ADD CONSTRAINT "withdrawal_strategy_runs_scenarioId_fkey"
    FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ai_insight_cache" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cacheKey" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB NOT NULL,
    CONSTRAINT "ai_insight_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_insight_cache_cacheKey_key" ON "ai_insight_cache"("cacheKey");
CREATE INDEX "ai_insight_cache_householdId_idx" ON "ai_insight_cache"("householdId");
CREATE INDEX "ai_insight_cache_runId_idx" ON "ai_insight_cache"("runId");

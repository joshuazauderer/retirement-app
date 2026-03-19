/**
 * aiCacheService — in-memory + DB-backed cache for AI insight responses.
 *
 * Cache key: householdId + runId + insightType + promptVersion
 * In-memory cache for same-process requests.
 * DB-backed cache via AiInsightCache Prisma model for cross-request persistence.
 *
 * Cache TTL: 24 hours (insights don't change unless the underlying run changes)
 */

import type { AiCacheEntry, InsightInput, InsightOutput, AiProvider } from './types';
import { AI_PROMPT_VERSION } from './types';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// In-memory cache for the current process
const memoryCache = new Map<string, AiCacheEntry>();

function buildCacheKey(input: InsightInput, promptVersion: string): string {
  return `${input.householdId}:${input.runId}:${input.insightType}:${promptVersion}`;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Attempt to retrieve a cached insight.
 * Checks memory cache first, then DB.
 */
export async function getCachedInsight(input: InsightInput): Promise<InsightOutput | null> {
  const cacheKey = buildCacheKey(input, AI_PROMPT_VERSION);

  // Check memory cache
  const memEntry = memoryCache.get(cacheKey);
  if (memEntry) {
    const age = Date.now() - new Date(memEntry.generatedAt).getTime();
    if (age < CACHE_TTL_MS) return memEntry.output;
    memoryCache.delete(cacheKey);
  }

  // Check DB cache
  try {
    const dbEntry = await prisma.aiInsightCache.findUnique({
      where: { cacheKey },
    });

    if (dbEntry) {
      const age = Date.now() - dbEntry.generatedAt.getTime();
      if (age < CACHE_TTL_MS) {
        const output = dbEntry.outputJson as unknown as InsightOutput;
        // Repopulate memory cache
        memoryCache.set(cacheKey, {
          cacheKey,
          insightType: input.insightType,
          input,
          output,
          promptVersion: dbEntry.promptVersion,
          generatedAt: dbEntry.generatedAt.toISOString(),
          provider: dbEntry.provider as AiProvider,
        });
        return output;
      }
    }
  } catch {
    // DB cache miss is non-fatal
  }

  return null;
}

/**
 * Store a generated insight in cache.
 */
export async function setCachedInsight(
  input: InsightInput,
  output: InsightOutput,
  provider: AiProvider,
): Promise<void> {
  const cacheKey = buildCacheKey(input, AI_PROMPT_VERSION);
  const entry: AiCacheEntry = {
    cacheKey,
    insightType: input.insightType,
    input,
    output,
    promptVersion: AI_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    provider,
  };

  // Always update memory cache
  memoryCache.set(cacheKey, entry);

  // Persist to DB (upsert)
  try {
    await prisma.aiInsightCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        householdId: input.householdId,
        runId: input.runId,
        insightType: input.insightType,
        promptVersion: AI_PROMPT_VERSION,
        inputJson: input as unknown as Prisma.InputJsonValue,
        outputJson: output as unknown as Prisma.InputJsonValue,
        provider,
      },
      update: {
        outputJson: output as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
        promptVersion: AI_PROMPT_VERSION,
        provider,
      },
    });
  } catch {
    // DB cache write failure is non-fatal
  }
}

/**
 * Invalidate cache entries for a run (e.g., if the run is re-generated).
 */
export async function invalidateRunCache(runId: string, householdId: string): Promise<void> {
  // Clear memory cache entries for this run
  for (const [key] of memoryCache) {
    if (key.includes(runId)) memoryCache.delete(key);
  }

  // Clear DB cache
  try {
    await prisma.aiInsightCache.deleteMany({
      where: { runId, householdId },
    });
  } catch {
    // Non-fatal
  }
}

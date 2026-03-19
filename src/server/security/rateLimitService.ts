/**
 * rateLimitService — server-side rate limiting.
 *
 * Uses an in-memory sliding window counter (per-process).
 * For multi-process deployments, this should be replaced with Redis-backed rate limiting.
 * For v1 single-process deployment (Coolify), in-memory is sufficient.
 *
 * Limits are per userId (or IP as fallback).
 * Never rely on client-side rate limiting.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory store: key → { count, windowStart }
const store = new Map<string, RateLimitEntry>();

// Cleanup interval to prevent memory leak (clear expired entries every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > 60_000 * 60) { // 1 hour max window
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;       // Window duration in ms
  maxRequests: number;    // Max requests per window
  identifier: string;     // userId or IP
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;        // Unix timestamp when window resets
  retryAfterMs?: number;
}

/**
 * Check and apply rate limit. Mutates the store.
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { windowMs, maxRequests, identifier } = config;
  const now = Date.now();
  const key = `${identifier}:${Math.floor(now / windowMs)}`;

  const entry = store.get(key) ?? { count: 0, windowStart: now };
  entry.count += 1;
  store.set(key, entry);

  const windowEnd = entry.windowStart + windowMs;
  const remaining = Math.max(0, maxRequests - entry.count);
  const allowed = entry.count <= maxRequests;

  return {
    allowed,
    remaining,
    resetAt: windowEnd,
    retryAfterMs: allowed ? undefined : windowEnd - now,
  };
}

// Pre-configured limiters for different endpoint types

/** Authentication endpoints: 10 per 15 minutes */
export function authRateLimit(identifier: string): RateLimitResult {
  return checkRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 10, identifier: `auth:${identifier}` });
}

/** AI endpoints: 20 per minute */
export function aiRateLimit(identifier: string): RateLimitResult {
  return checkRateLimit({ windowMs: 60 * 1000, maxRequests: 20, identifier: `ai:${identifier}` });
}

/** Simulation endpoints: 10 per minute */
export function simulationRateLimit(identifier: string): RateLimitResult {
  return checkRateLimit({ windowMs: 60 * 1000, maxRequests: 10, identifier: `sim:${identifier}` });
}

/** Chat/copilot endpoints: 30 per minute */
export function copilotRateLimit(identifier: string): RateLimitResult {
  return checkRateLimit({ windowMs: 60 * 1000, maxRequests: 30, identifier: `chat:${identifier}` });
}

/** General API: 100 per minute */
export function generalRateLimit(identifier: string): RateLimitResult {
  return checkRateLimit({ windowMs: 60 * 1000, maxRequests: 100, identifier: `api:${identifier}` });
}

/**
 * Build rate limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
    ...(result.retryAfterMs ? { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) } : {}),
  };
}

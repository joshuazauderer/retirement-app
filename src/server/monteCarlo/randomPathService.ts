/**
 * Seeded pseudo-random number generation and return path synthesis.
 *
 * Design notes:
 * - Uses Mulberry32, a well-regarded 32-bit PRNG with excellent statistical properties.
 *   Same seed always produces the same sequence — critical for reproducibility.
 * - Normal distribution sampling via Box-Muller transform applied to the uniform RNG.
 * - Return model: independent annual draws from N(mean, volatility).
 *   This is a v1 simplification; no autocorrelation or regime-switching is modeled.
 * - Extreme returns are clamped to [RETURN_FLOOR, RETURN_CAP] to prevent
 *   catastrophic single-year portfolio wipeouts that are unrealistic for
 *   diversified retirement portfolios. The floor/cap are documented constants.
 */

import { MC_BOUNDS } from './types';

/**
 * Mulberry32 PRNG.
 * Returns a factory that, given a seed, produces a deterministic sequence of
 * uniform random values in [0, 1).
 *
 * Reference: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */
export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0; // ensure unsigned 32-bit
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample one value from N(mean, std) using the Box-Muller transform.
 * Consumes two uniform random values from the provided RNG.
 */
export function sampleNormal(rng: () => number, mean: number, std: number): number {
  // Guard against log(0) by flooring u1 at a tiny positive value
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

/**
 * Generate one simulated annual return path of `length` years.
 * Returns are clamped to [RETURN_FLOOR, RETURN_CAP] to avoid unrealistic extremes.
 *
 * The clamping rule is applied symmetrically and documented here:
 * - Floor: -50% — prevents single-year total-portfolio wipeout scenarios that
 *   would not occur for a well-diversified retirement portfolio.
 * - Cap: +100% — prevents single-year doubling that inflates success rates
 *   unrealistically for conservative portfolios.
 */
export function generateReturnPath(
  rng: () => number,
  meanReturn: number,
  volatility: number,
  length: number
): number[] {
  const path: number[] = [];
  for (let i = 0; i < length; i++) {
    const raw = sampleNormal(rng, meanReturn, volatility);
    path.push(Math.min(MC_BOUNDS.RETURN_CAP, Math.max(MC_BOUNDS.RETURN_FLOOR, raw)));
  }
  return path;
}

/**
 * Generate N seeded return paths.
 * All paths share one RNG instance seeded at `seed`, so the full set is
 * reproducible: same seed + same (N, mean, vol, length) → identical paths.
 */
export function generateAllReturnPaths(
  seed: number,
  simulationCount: number,
  meanReturn: number,
  volatility: number,
  horizonYears: number
): number[][] {
  const rng = createSeededRng(seed);
  const paths: number[][] = [];
  for (let i = 0; i < simulationCount; i++) {
    paths.push(generateReturnPath(rng, meanReturn, volatility, horizonYears));
  }
  return paths;
}

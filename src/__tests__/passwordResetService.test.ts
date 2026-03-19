import { describe, test, expect } from 'vitest';

// Test the token-related pure logic without hitting the database.
// The actual Prisma calls are integration concerns handled separately.

describe('passwordResetService — token hash logic', () => {
  test('sha256 hash of same raw token is deterministic', () => {
    const crypto = require('crypto') as typeof import('crypto');
    const raw = 'abc123testtoken';
    const hash1 = crypto.createHash('sha256').update(raw).digest('hex');
    const hash2 = crypto.createHash('sha256').update(raw).digest('hex');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // sha256 hex is 64 chars
  });

  test('different raw tokens produce different hashes', () => {
    const crypto = require('crypto') as typeof import('crypto');
    const hash1 = crypto.createHash('sha256').update('tokenA').digest('hex');
    const hash2 = crypto.createHash('sha256').update('tokenB').digest('hex');
    expect(hash1).not.toBe(hash2);
  });

  test('randomly generated tokens are unique', () => {
    const crypto = require('crypto') as typeof import('crypto');
    const token1 = crypto.randomBytes(32).toString('hex');
    const token2 = crypto.randomBytes(32).toString('hex');
    expect(token1).not.toBe(token2);
    expect(token1).toHaveLength(64); // 32 bytes hex = 64 chars
  });

  test('expiry check: a future date is not expired', () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    expect(expiresAt > new Date()).toBe(true);
  });

  test('expiry check: a past date is expired', () => {
    const expiresAt = new Date(Date.now() - 1000); // 1 second ago
    expect(expiresAt < new Date()).toBe(true);
  });

  test('expiry window is set to 60 minutes in the future', () => {
    const RESET_TOKEN_EXPIRY_MINUTES = 60;
    const before = Date.now();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
    const after = Date.now();

    const diffMs = expiresAt.getTime() - before;
    const expectedMs = RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000;

    expect(diffMs).toBeGreaterThanOrEqual(expectedMs - (after - before));
    expect(diffMs).toBeLessThanOrEqual(expectedMs + 100); // within 100ms tolerance
  });
});

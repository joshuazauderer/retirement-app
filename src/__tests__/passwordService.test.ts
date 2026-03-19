import { describe, test, expect } from 'vitest';
import { validatePasswordPolicy } from '../server/auth/passwordService';

describe('validatePasswordPolicy', () => {
  test('accepts a valid password with uppercase and number', () => {
    const result = validatePasswordPolicy('SecurePass1');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects password shorter than 8 characters', () => {
    const result = validatePasswordPolicy('Ab1');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/at least 8 characters/);
  });

  test('rejects password without uppercase letter', () => {
    const result = validatePasswordPolicy('alllowercase1');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/uppercase/);
  });

  test('rejects password without a number', () => {
    const result = validatePasswordPolicy('NoNumbersHere');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/number/);
  });

  test('returns all errors for a completely invalid password', () => {
    // Too short, no uppercase, no number
    const result = validatePasswordPolicy('ab');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  test('accepts password with exactly 8 characters meeting all criteria', () => {
    const result = validatePasswordPolicy('Secure1!');
    expect(result.valid).toBe(true);
  });

  test('accepts a long complex password', () => {
    const result = validatePasswordPolicy('MyVeryLongAndSecurePassword123!@#');
    expect(result.valid).toBe(true);
  });
});

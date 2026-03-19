import { describe, test, expect } from 'vitest';
import {
  validateClosureConfirmation,
  CLOSURE_CONFIRMATION_PHRASE,
} from '../server/account/accountClosureService';

describe('validateClosureConfirmation', () => {
  test('accepts exact phrase', () => {
    const result = validateClosureConfirmation('DELETE MY ACCOUNT');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('accepts lowercase version (case-insensitive)', () => {
    const result = validateClosureConfirmation('delete my account');
    expect(result.valid).toBe(true);
  });

  test('accepts mixed-case phrase', () => {
    const result = validateClosureConfirmation('Delete My Account');
    expect(result.valid).toBe(true);
  });

  test('accepts phrase with leading/trailing whitespace', () => {
    const result = validateClosureConfirmation('  DELETE MY ACCOUNT  ');
    expect(result.valid).toBe(true);
  });

  test('rejects empty string', () => {
    const result = validateClosureConfirmation('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('rejects partial phrase', () => {
    const result = validateClosureConfirmation('DELETE MY');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('rejects wrong phrase', () => {
    const result = validateClosureConfirmation('I agree to close');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/DELETE MY ACCOUNT/);
  });

  test('CLOSURE_CONFIRMATION_PHRASE export matches expected value', () => {
    expect(CLOSURE_CONFIRMATION_PHRASE).toBe('DELETE MY ACCOUNT');
  });

  test('error message includes the required phrase', () => {
    const result = validateClosureConfirmation('wrong');
    expect(result.error).toContain('DELETE MY ACCOUNT');
  });
});

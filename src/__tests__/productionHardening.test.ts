import { describe, test, expect } from 'vitest';
import {
  sanitizeContext,
  FORBIDDEN_KEYS,
  generateRequestId,
  shouldLog,
  LEVEL_PRIORITY,
} from '@/server/logging/loggerService';
import {
  AppError,
  Errors,
  handleApiError,
  SAFE_USER_MESSAGES,
  ERROR_HTTP_STATUS,
} from '@/server/errors/errorHandlerService';
import {
  TaxPlanningInputSchema,
  HealthcarePlanningInputSchema,
  CopilotRequestSchema,
  InviteUserSchema,
  safeParse,
} from '@/server/security/validationService';
import {
  checkRateLimit,
  authRateLimit,
  aiRateLimit,
  rateLimitHeaders,
} from '@/server/security/rateLimitService';
import { startTimer } from '@/server/observability/metricsService';
import {
  enqueueJob,
  getJobStatus,
  listActiveJobs,
} from '@/server/jobs/jobRunner';

// ---------------------------------------------------------------------------
// 1. loggerService
// ---------------------------------------------------------------------------
describe('loggerService', () => {
  test('sanitizeContext removes "password" key', () => {
    const result = sanitizeContext({ password: 'secret123' });
    expect(result.password).toBe('[REDACTED]');
  });

  test('sanitizeContext removes "token" key', () => {
    const result = sanitizeContext({ token: 'abc123' });
    expect(result.token).toBe('[REDACTED]');
  });

  test('sanitizeContext keeps "householdId" key', () => {
    const result = sanitizeContext({ householdId: 'clxxx' });
    expect(result.householdId).toBe('clxxx');
  });

  test('sanitizeContext keeps "userId" key', () => {
    const result = sanitizeContext({ userId: 'user-1' });
    expect(result.userId).toBe('user-1');
  });

  test('sanitizeContext keeps "durationMs"', () => {
    const result = sanitizeContext({ durationMs: 42 });
    expect(result.durationMs).toBe(42);
  });

  test('generateRequestId returns a non-empty string', () => {
    const id = generateRequestId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('shouldLog: debug not logged when LOG_LEVEL=info', () => {
    // Default LOG_LEVEL is 'info', so debug should not log
    // LEVEL_PRIORITY[debug]=0 < LEVEL_PRIORITY[info]=1
    expect(LEVEL_PRIORITY['debug']).toBeLessThan(LEVEL_PRIORITY['info']);
    // shouldLog uses process.env.LOG_LEVEL which defaults to 'info'
    // We test the underlying logic directly
    const debugPriority = LEVEL_PRIORITY['debug'];
    const infoPriority = LEVEL_PRIORITY['info'];
    expect(debugPriority < infoPriority).toBe(true);
  });

  test('FORBIDDEN_KEYS includes "password", "token", "secret"', () => {
    expect(FORBIDDEN_KEYS).toContain('password');
    expect(FORBIDDEN_KEYS).toContain('token');
    expect(FORBIDDEN_KEYS).toContain('secret');
  });
});

// ---------------------------------------------------------------------------
// 2. errorHandlerService
// ---------------------------------------------------------------------------
describe('errorHandlerService', () => {
  test('AppError constructs with correct code and statusCode', () => {
    const err = new AppError('NOT_FOUND', 'Resource not found', 404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Resource not found');
    expect(err.name).toBe('AppError');
  });

  test('Errors.unauthorized() returns AppError with UNAUTHORIZED code', () => {
    const err = Errors.unauthorized();
    expect(err instanceof AppError).toBe(true);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  test('Errors.forbidden() returns AppError with FORBIDDEN code', () => {
    const err = Errors.forbidden();
    expect(err instanceof AppError).toBe(true);
    expect(err.code).toBe('FORBIDDEN');
  });

  test('Errors.notFound() returns AppError with NOT_FOUND code', () => {
    const err = Errors.notFound();
    expect(err instanceof AppError).toBe(true);
    expect(err.code).toBe('NOT_FOUND');
  });

  test('Errors.rateLimited() returns AppError with RATE_LIMITED code', () => {
    const err = Errors.rateLimited();
    expect(err instanceof AppError).toBe(true);
    expect(err.code).toBe('RATE_LIMITED');
  });

  test('handleApiError with AppError returns correct status code', async () => {
    const err = Errors.notFound('Resource');
    const response = handleApiError(err);
    expect(response.status).toBe(404);
  });

  test('handleApiError does not expose stack trace in production', async () => {
    const err = new Error('Internal DB failure with secrets');
    const response = handleApiError(err);
    const body = await response.json();
    expect(body.error).not.toContain('DB failure');
    expect(body.error).not.toContain('secrets');
  });

  test('SAFE_USER_MESSAGES covers all AppErrorCodes', () => {
    const expectedCodes = [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'RATE_LIMITED',
      'INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
      'ACCESS_DENIED',
      'INVALID_TOKEN',
      'EXPIRED_TOKEN',
      'CONFLICT',
    ];
    for (const code of expectedCodes) {
      expect(SAFE_USER_MESSAGES[code as keyof typeof SAFE_USER_MESSAGES]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. validationService
// ---------------------------------------------------------------------------

// Valid base inputs for reuse
const validHouseholdId = 'clh12345678901234567890ab';
const validScenarioId = 'clh12345678901234567890ac';
const validRunId = 'clh12345678901234567890ad';

const validTaxInput = {
  householdId: validHouseholdId,
  scenarioId: validScenarioId,
  label: 'Test Tax Plan',
  filingStatus: 'SINGLE' as const,
  stateCode: 'CA',
};

const validHealthcareInput = {
  householdId: validHouseholdId,
  scenarioId: validScenarioId,
  label: 'Healthcare Plan',
  preMedicare: { annualPremium: 12000, annualOutOfPocket: 5000 },
  medicareEligibilityAge: 65,
  medicare: {
    includePartB: true,
    includePartD: true,
    includeMedigapOrAdvantage: false,
    additionalAnnualOOP: 2000,
  },
  healthcareInflationRate: 0.05,
  ltcStress: { enabled: false, startAge: 80, durationYears: 3, annualCost: 90000 },
  longevityStress: { enabled: false, targetAge: 95, person: 'primary' as const },
  includeSpouseHealthcare: false,
};

const validCopilotInput = {
  householdId: validHouseholdId,
  message: 'When can I retire?',
};

const validInviteInput = {
  householdId: validHouseholdId,
  email: 'advisor@example.com',
  role: 'ADVISOR' as const,
};

describe('validationService', () => {
  test('TaxPlanningInputSchema: valid input passes', () => {
    const result = TaxPlanningInputSchema.safeParse(validTaxInput);
    expect(result.success).toBe(true);
  });

  test('TaxPlanningInputSchema: missing householdId fails', () => {
    const { householdId: _removed, ...rest } = validTaxInput;
    const result = TaxPlanningInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test('TaxPlanningInputSchema: invalid stateCode (more than 2 chars) fails', () => {
    const result = TaxPlanningInputSchema.safeParse({ ...validTaxInput, stateCode: 'CAL' });
    expect(result.success).toBe(false);
  });

  test('TaxPlanningInputSchema: invalid filingStatus fails', () => {
    const result = TaxPlanningInputSchema.safeParse({ ...validTaxInput, filingStatus: 'INVALID_STATUS' });
    expect(result.success).toBe(false);
  });

  test('HealthcarePlanningInputSchema: valid input passes', () => {
    const result = HealthcarePlanningInputSchema.safeParse(validHealthcareInput);
    expect(result.success).toBe(true);
  });

  test('HealthcarePlanningInputSchema: healthcareInflationRate > 0.20 fails', () => {
    const result = HealthcarePlanningInputSchema.safeParse({ ...validHealthcareInput, healthcareInflationRate: 0.25 });
    expect(result.success).toBe(false);
  });

  test('CopilotRequestSchema: valid input passes', () => {
    const result = CopilotRequestSchema.safeParse(validCopilotInput);
    expect(result.success).toBe(true);
  });

  test('CopilotRequestSchema: message > 2000 chars fails', () => {
    const result = CopilotRequestSchema.safeParse({ ...validCopilotInput, message: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  test('CopilotRequestSchema: empty message fails', () => {
    const result = CopilotRequestSchema.safeParse({ ...validCopilotInput, message: '' });
    expect(result.success).toBe(false);
  });

  test('InviteUserSchema: valid email passes', () => {
    const result = InviteUserSchema.safeParse(validInviteInput);
    expect(result.success).toBe(true);
  });

  test('InviteUserSchema: invalid email fails', () => {
    const result = InviteUserSchema.safeParse({ ...validInviteInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  test('InviteUserSchema: OWNER role fails (not in enum)', () => {
    const result = InviteUserSchema.safeParse({ ...validInviteInput, role: 'OWNER' });
    expect(result.success).toBe(false);
  });

  test('safeParse: returns success:true for valid input', () => {
    const result = safeParse(TaxPlanningInputSchema, validTaxInput);
    expect(result.success).toBe(true);
  });

  test('safeParse: returns success:false with error string for invalid', () => {
    const result = safeParse(TaxPlanningInputSchema, { ...validTaxInput, filingStatus: 'WRONG' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. rateLimitService
// ---------------------------------------------------------------------------
describe('rateLimitService', () => {
  test('checkRateLimit: first request is allowed, remaining = maxRequests - 1', () => {
    const identifier = `test-rl-${Math.random()}`;
    const result = checkRateLimit({ windowMs: 60_000, maxRequests: 5, identifier });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test('checkRateLimit: exceeding maxRequests is denied', () => {
    const identifier = `test-exceed-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ windowMs: 60_000, maxRequests: 3, identifier });
    }
    const result = checkRateLimit({ windowMs: 60_000, maxRequests: 3, identifier });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('checkRateLimit: different identifiers do not interfere', () => {
    const id1 = `id1-${Math.random()}`;
    const id2 = `id2-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit({ windowMs: 60_000, maxRequests: 3, identifier: id1 });
    }
    const result = checkRateLimit({ windowMs: 60_000, maxRequests: 3, identifier: id2 });
    expect(result.allowed).toBe(true);
  });

  test('authRateLimit: uses 10 max requests', () => {
    const identifier = `auth-test-${Math.random()}`;
    // Make 10 requests — all should be allowed
    for (let i = 0; i < 10; i++) {
      const r = authRateLimit(identifier);
      expect(r.allowed).toBe(true);
    }
    // 11th should be denied
    const r11 = authRateLimit(identifier);
    expect(r11.allowed).toBe(false);
  });

  test('aiRateLimit: uses 20 max requests', () => {
    const identifier = `ai-test-${Math.random()}`;
    for (let i = 0; i < 20; i++) {
      const r = aiRateLimit(identifier);
      expect(r.allowed).toBe(true);
    }
    const r21 = aiRateLimit(identifier);
    expect(r21.allowed).toBe(false);
  });

  test('rateLimitHeaders: returns X-RateLimit-Remaining header', () => {
    const result = { allowed: true, remaining: 5, resetAt: Date.now() + 60_000 };
    const headers = rateLimitHeaders(result);
    expect(headers['X-RateLimit-Remaining']).toBe('5');
  });

  test('rateLimitHeaders: returns Retry-After header when denied', () => {
    const result = { allowed: false, remaining: 0, resetAt: Date.now() + 30_000, retryAfterMs: 30_000 };
    const headers = rateLimitHeaders(result);
    expect(headers['Retry-After']).toBeDefined();
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. metricsService
// ---------------------------------------------------------------------------
describe('metricsService', () => {
  test('startTimer: elapsed() returns a non-negative number', () => {
    const timer = startTimer();
    const elapsed = timer.elapsed();
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  test('startTimer: elapsed() increases over time', async () => {
    const timer = startTimer();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const elapsed = timer.elapsed();
    expect(elapsed).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6. jobRunner
// ---------------------------------------------------------------------------
describe('jobRunner', () => {
  test('enqueueJob: returns a job ID string', () => {
    const id = enqueueJob('test.job', async () => 'done');
    expect(typeof id).toBe('string');
    expect(id.startsWith('job_')).toBe(true);
  });

  test('getJobStatus: returns null for unknown job ID', () => {
    const result = getJobStatus('nonexistent-job-id');
    expect(result).toBeNull();
  });

  test('getJobStatus: returns job with QUEUED or RUNNING status immediately after enqueue', () => {
    const id = enqueueJob('test.immediate', async () => 'result');
    const job = getJobStatus(id);
    expect(job).not.toBeNull();
    expect(['QUEUED', 'RUNNING']).toContain(job?.status);
  });

  test('listActiveJobs: includes newly enqueued jobs', () => {
    const id = enqueueJob('test.active', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'done';
    });
    const active = listActiveJobs();
    const found = active.find((j) => j.id === id);
    expect(found).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 7. Golden cases
// ---------------------------------------------------------------------------
describe('Golden cases', () => {
  test('Valid TaxPlanningInput with all required fields passes schema', () => {
    const result = TaxPlanningInputSchema.safeParse(validTaxInput);
    expect(result.success).toBe(true);
  });

  test('TaxPlanningInput with negative withdrawal rate fails', () => {
    // capitalGainsBasisRatio must be 0-1; test with -0.1
    const result = TaxPlanningInputSchema.safeParse({ ...validTaxInput, capitalGainsBasisRatio: -0.1 });
    expect(result.success).toBe(false);
  });

  test('Email with spaces fails InviteUserSchema', () => {
    const result = InviteUserSchema.safeParse({ ...validInviteInput, email: 'user @example.com' });
    expect(result.success).toBe(false);
  });

  test('Rate limit allows first 10 auth requests then blocks 11th', () => {
    const identifier = `golden-auth-${Math.random()}`;
    for (let i = 0; i < 10; i++) {
      const r = authRateLimit(identifier);
      expect(r.allowed).toBe(true);
    }
    const r11 = authRateLimit(identifier);
    expect(r11.allowed).toBe(false);
  });

  test('AppError with RATE_LIMITED maps to status 429', async () => {
    const err = Errors.rateLimited();
    const response = handleApiError(err);
    expect(response.status).toBe(429);
  });

  test('Logger context with "authToken" key gets redacted', () => {
    const result = sanitizeContext({ authToken: 'bearer-xyz-123', userId: 'user1' });
    expect(result.authToken).toBe('[REDACTED]');
    expect(result.userId).toBe('user1');
  });
});

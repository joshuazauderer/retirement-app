/**
 * errorHandlerService — centralized error handling and formatting.
 *
 * Rules:
 * - User-facing messages must not expose internal details
 * - Stack traces are logged but never returned to clients
 * - Error codes are consistent and typed
 * - All API errors use this service for consistent format
 */

import { NextResponse } from 'next/server';
import { logger } from '../logging/loggerService';

export type AppErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'ACCESS_DENIED'
  | 'INVALID_TOKEN'
  | 'EXPIRED_TOKEN'
  | 'CONFLICT';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly details?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ERROR_HTTP_STATUS: Record<AppErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  ACCESS_DENIED: 403,
  INVALID_TOKEN: 400,
  EXPIRED_TOKEN: 400,
  CONFLICT: 409,
};

// Safe user-facing messages (no internal details)
export const SAFE_USER_MESSAGES: Record<AppErrorCode, string> = {
  UNAUTHORIZED: 'Authentication required.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'The request contained invalid data.',
  RATE_LIMITED: 'Too many requests. Please try again shortly.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
  SERVICE_UNAVAILABLE: 'This service is temporarily unavailable.',
  ACCESS_DENIED: 'Access denied.',
  INVALID_TOKEN: 'The provided token is invalid.',
  EXPIRED_TOKEN: 'The provided token has expired.',
  CONFLICT: 'A conflict occurred with the current state.',
};

export interface ApiErrorResponse {
  error: string;
  code: AppErrorCode;
  requestId?: string;
}

/**
 * Handle an error from an API route and return a NextResponse.
 */
export function handleApiError(
  err: unknown,
  context?: { userId?: string; householdId?: string; requestId?: string; route?: string },
): NextResponse<ApiErrorResponse> {
  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.code}`, { ...context, action: err.code });
    return NextResponse.json(
      { error: SAFE_USER_MESSAGES[err.code], code: err.code, requestId: context?.requestId },
      { status: ERROR_HTTP_STATUS[err.code] },
    );
  }

  // ZodError — validation failure
  if (err instanceof Error && err.name === 'ZodError') {
    logger.warn('Validation error', context);
    return NextResponse.json(
      { error: SAFE_USER_MESSAGES.VALIDATION_ERROR, code: 'VALIDATION_ERROR' as AppErrorCode, requestId: context?.requestId },
      { status: 422 },
    );
  }

  // Known error messages from services
  if (err instanceof Error) {
    if (err.message === 'ACCESS_DENIED' || err.message === 'EDIT_ACCESS_DENIED' || err.message === 'MANAGE_ACCESS_DENIED') {
      logger.warn('Access denied', context);
      return NextResponse.json(
        { error: SAFE_USER_MESSAGES.FORBIDDEN, code: 'FORBIDDEN' as AppErrorCode, requestId: context?.requestId },
        { status: 403 },
      );
    }

    // Unexpected error — log full details, return safe message
    logger.error('Unhandled error in API route', context, err);
    return NextResponse.json(
      { error: SAFE_USER_MESSAGES.INTERNAL_ERROR, code: 'INTERNAL_ERROR' as AppErrorCode, requestId: context?.requestId },
      { status: 500 },
    );
  }

  logger.error('Unknown error type', context);
  return NextResponse.json(
    { error: SAFE_USER_MESSAGES.INTERNAL_ERROR, code: 'INTERNAL_ERROR' as AppErrorCode, requestId: context?.requestId },
    { status: 500 },
  );
}

/**
 * Create typed AppErrors for common cases.
 */
export const Errors = {
  unauthorized: () => new AppError('UNAUTHORIZED', 'Authentication required', 401),
  forbidden: (detail?: string) => new AppError('FORBIDDEN', detail ?? 'Access denied', 403),
  notFound: (resource?: string) => new AppError('NOT_FOUND', resource ? `${resource} not found` : 'Not found', 404),
  validation: (detail?: string) => new AppError('VALIDATION_ERROR', detail ?? 'Validation failed', 422),
  rateLimited: () => new AppError('RATE_LIMITED', 'Rate limit exceeded', 429),
  internal: () => new AppError('INTERNAL_ERROR', 'Internal error', 500),
  conflict: (detail?: string) => new AppError('CONFLICT', detail ?? 'Conflict', 409),
  invalidToken: () => new AppError('INVALID_TOKEN', 'Invalid token', 400),
  expiredToken: () => new AppError('EXPIRED_TOKEN', 'Token expired', 400),
};

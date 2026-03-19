/**
 * loggerService — structured JSON logging for production observability.
 *
 * SECURITY RULES:
 * - Never log passwords, tokens, secret keys, or raw financial account numbers
 * - UserId and householdId are allowed (internal identifiers for debugging)
 * - Financial summary values (totals, aggregates) are allowed
 * - Log levels: info, warn, error, debug
 *
 * Output: structured JSON to stdout (Coolify captures and can forward)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  householdId?: string;
  requestId?: string;
  action?: string;
  durationMs?: number;
  statusCode?: number;
  route?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    message: string;
    code?: string;
    stack?: string; // Only in non-production
  };
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = (process.env.LOG_LEVEL ?? 'info') as LogLevel;

export const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL];
}

// Sanitize context to strip any accidentally included sensitive fields
export const FORBIDDEN_KEYS = ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization', 'cookie'];

export function sanitizeContext(ctx: LogContext): LogContext {
  const sanitized: LogContext = {};
  for (const [k, v] of Object.entries(ctx)) {
    const lower = k.toLowerCase();
    if (FORBIDDEN_KEYS.some((f) => lower.includes(f))) {
      sanitized[k] = '[REDACTED]';
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

function writeLog(level: LogLevel, message: string, context: LogContext = {}, error?: Error): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: sanitizeContext(context),
  };

  if (error) {
    entry.error = {
      message: error.message,
      code: (error as NodeJS.ErrnoException).code,
      stack: IS_PRODUCTION ? undefined : error.stack,
    };
  }

  // Write JSON to appropriate stream
  const output = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => writeLog('debug', message, context),
  info: (message: string, context?: LogContext) => writeLog('info', message, context),
  warn: (message: string, context?: LogContext, error?: Error) => writeLog('warn', message, context, error),
  error: (message: string, context?: LogContext, error?: Error) => writeLog('error', message, context, error),
};

/** Generate a random request ID for correlation */
export function generateRequestId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

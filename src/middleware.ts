import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

function generateRequestId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Security headers for all responses
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Use edge-safe authConfig (no Prisma, no bcryptjs) for middleware
const { auth } = NextAuth(authConfig);

export default auth(function middleware(request: NextRequest) {
  const requestId = generateRequestId();
  const response = NextResponse.next();

  // Inject request ID for correlation
  response.headers.set('X-Request-ID', requestId);

  // Apply security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // Log incoming request — use console.log (edge-safe; process.stdout is undefined in Edge Runtime)
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'http.request',
    context: {
      method: request.method,
      path: request.nextUrl.pathname,
      requestId,
      userAgent: request.headers.get('user-agent')?.slice(0, 100) ?? 'unknown',
    },
  }));

  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};

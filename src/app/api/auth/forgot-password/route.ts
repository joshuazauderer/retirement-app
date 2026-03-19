import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/server/auth/passwordResetService';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
    }

    // Always returns success (anti-enumeration)
    await requestPasswordReset(result.data.email);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

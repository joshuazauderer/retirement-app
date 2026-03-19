import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resetPassword } from '@/server/auth/passwordResetService';

const schema = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
    }

    const { token, newPassword } = result.data;
    const resetResult = await resetPassword({ rawToken: token, newPassword });

    if (!resetResult.success) {
      return NextResponse.json({ error: resetResult.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

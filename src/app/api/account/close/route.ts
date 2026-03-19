import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { closeAccount } from '@/server/account/accountClosureService';

const schema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmationPhrase: z.string().min(1, 'Confirmation phrase is required'),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
    }

    const { password, confirmationPhrase } = result.data;
    const closeResult = await closeAccount({
      userId: session.user.id,
      password,
      confirmationPhrase,
    });

    if (!closeResult.success) {
      return NextResponse.json({ error: closeResult.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

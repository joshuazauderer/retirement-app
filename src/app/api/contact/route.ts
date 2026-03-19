import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendContactRequestEmail } from '@/server/email/emailSender';

const schema = z.object({
  name:    z.string().min(1).max(100).trim(),
  email:   z.string().email().max(255).trim(),
  subject: z.string().max(200).trim().optional().or(z.literal('')),
  message: z.string().min(10).max(5000).trim(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as unknown;
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, subject, message } = parsed.data;
    const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;
    const userAgent = req.headers.get('user-agent') ?? null;
    const submittedAt = new Date();

    // Save to DB
    await prisma.contactRequest.create({
      data: {
        name,
        email,
        subject: subject || null,
        message,
        ipAddress,
        userAgent,
      },
    });

    // Send notification email (non-blocking on failure)
    await sendContactRequestEmail({ name, email, subject: subject || null, message, submittedAt });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

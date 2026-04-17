import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

const safeText = z.string().transform((val) => val.replace(/<[^>]*>/g, '').trim());

const supportTicketSchema = z.object({
  type: z.enum(['bug', 'feedback', 'support'], { message: 'Invalid type' }),
  message: safeText.pipe(
    z
      .string()
      .min(10, 'Message must be at least 10 characters')
      .max(2000, 'Message must be at most 2000 characters'),
  ),
});

// Per-user cap — authed-only endpoint, so a user ID is the natural key.
// Ten tickets/hour is generous for legit use, tight enough to stop spam.
const SUPPORT_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`support:${user.id}`, SUPPORT_RATE_LIMIT);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many tickets submitted. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = supportTicketSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.message?.[0] ??
      parsed.error.flatten().fieldErrors.type?.[0] ??
      'Invalid input';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { type, message } = parsed.data;

  const { error } = await supabase
    .from('support_tickets')
    .insert({ user_id: user.id, type, message });

  if (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Failed to submit ticket' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

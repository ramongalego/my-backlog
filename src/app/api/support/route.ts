import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkSharedRateLimit } from '@/lib/rate-limit';
import { tryCreateServiceClient } from '@/lib/supabase/service';

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

  const rateLimitResult = await checkSharedRateLimit(`support:${user.id}`, SUPPORT_RATE_LIMIT);
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

  // Written with the server's key: users can't insert tickets themselves, so
  // the limits above can't be skipped by writing to the table directly.
  const service = tryCreateServiceClient();
  if (!service) {
    console.error('SUPABASE_SECRET_KEY not configured; cannot save tickets');
    return NextResponse.json({ error: 'Failed to submit ticket' }, { status: 500 });
  }
  const { error } = await service
    .from('support_tickets')
    .insert({ user_id: user.id, type, message });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to submit ticket' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

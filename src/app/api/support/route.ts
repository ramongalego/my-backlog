import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError } from '@/lib/server/api-response';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { supportTicketSchema } from '@/lib/validations/support';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  const rateLimitResult = await checkSharedRateLimit(`support:${user.id}`, RATE_LIMITS.support);
  if (!rateLimitResult.success) {
    return jsonError('Too many tickets submitted. Please try again later.', 429, {
      'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = supportTicketSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.message?.[0] ??
      parsed.error.flatten().fieldErrors.type?.[0] ??
      'Invalid input';
    return jsonError(message, 400);
  }

  const { type, message } = parsed.data;

  // Written with the server's key: users can't insert tickets themselves, so
  // the limits above can't be skipped by writing to the table directly.
  const service = tryCreateServiceClient();
  if (!service) {
    console.error('SUPABASE_SECRET_KEY not configured; cannot save tickets');
    return jsonError('Failed to submit ticket', 500);
  }
  const { error } = await service
    .from('support_tickets')
    .insert({ user_id: user.id, type, message });

  if (error) {
    console.error(error);
    return jsonError('Failed to submit ticket', 500);
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
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
    return NextResponse.json({ error: 'Failed to submit ticket' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/';

  const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}${safeNext}?error=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}${safeNext}?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}

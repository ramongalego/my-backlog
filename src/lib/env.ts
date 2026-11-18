// Next.js inlines NEXT_PUBLIC_* at build time, so they must be read as literal
// `process.env.NEXT_PUBLIC_*` references, never by a dynamic key.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

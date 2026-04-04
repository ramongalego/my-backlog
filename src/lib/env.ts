// Public environment variables (available in browser and server)
// NOTE: Next.js inlines NEXT_PUBLIC_* vars at build time — they must be accessed
// as literal `process.env.NEXT_PUBLIC_*` references, not via dynamic keys.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

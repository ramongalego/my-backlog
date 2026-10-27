// Server-only environment variables.
// Only import this file from API routes and server components — never from client code.

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getSteamApiKey(): string {
  return required('STEAM_API_KEY');
}

/** The Twitch app that IGDB authenticates, for adding games by hand. */
export function getIgdbCredentials(): { clientId: string; clientSecret: string } {
  return { clientId: required('IGDB_CLIENT_ID'), clientSecret: required('IGDB_CLIENT_SECRET') };
}

/** SteamGridDB, for art of games added by hand; optional, it's a fallback. */
export function getSteamGridDbKey(): string | null {
  return process.env.STEAM_GRID_API_KEY || null;
}

export function getOpenAIApiKey(): string {
  return required('OPENAI_API_KEY');
}

// A Supabase secret key (sb_secret_…), which bypasses RLS. The legacy
// service_role JWT still works under its old variable name.
export function getSupabaseSecretKey(): string {
  return process.env.SUPABASE_SECRET_KEY || required('SUPABASE_SERVICE_ROLE_KEY');
}

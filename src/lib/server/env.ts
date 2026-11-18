import 'server-only';
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

/** The Twitch app IGDB authenticates, for adding games by hand. */
export function getIgdbCredentials(): { clientId: string; clientSecret: string } {
  return { clientId: required('IGDB_CLIENT_ID'), clientSecret: required('IGDB_CLIENT_SECRET') };
}

/** Optional: SteamGridDB art for games added by hand is a fallback. */
export function getSteamGridDbKey(): string | null {
  return process.env.STEAM_GRID_API_KEY || null;
}

export function getOpenAIApiKey(): string {
  return required('OPENAI_API_KEY');
}

// Bypasses RLS. The legacy service_role JWT works under its own variable name.
export function getSupabaseSecretKey(): string {
  return process.env.SUPABASE_SECRET_KEY || required('SUPABASE_SERVICE_ROLE_KEY');
}

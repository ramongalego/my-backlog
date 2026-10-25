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

export function getOpenAIApiKey(): string {
  return required('OPENAI_API_KEY');
}

interface BlacklistedProfile {
  steamId: string;
  vanityNames: string[];
  message: string;
}

const BLACKLIST: BlacklistedProfile[] = [
  {
    steamId: '76561197960287930',
    vanityNames: ['gabelogannewell'],
    message: "Nah, I'm good. I don't want to roast Gabe.",
  },
];

/**
 * Check raw user input against the blacklist before resolving via Steam API.
 * Matches on vanity names (from URLs or bare input) and direct Steam IDs.
 */
export function getBlacklistMessage(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  for (const entry of BLACKLIST) {
    // Direct Steam ID match
    if (trimmed === entry.steamId) return entry.message;

    // Vanity URL from full profile link
    const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/\s]+)/);
    if (vanityMatch && entry.vanityNames.includes(vanityMatch[1].toLowerCase())) {
      return entry.message;
    }

    // Profile URL with numeric ID
    const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/);
    if (profileMatch && profileMatch[1] === entry.steamId) return entry.message;

    // Bare vanity name
    if (entry.vanityNames.includes(trimmed)) return entry.message;
  }

  return null;
}

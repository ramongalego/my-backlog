// Tag and name matching shared by Pick My Game and the Home carousels.

// Tags that say nothing about how a game plays.
export const GENERIC_TAGS = new Set([
  'Singleplayer',
  'Multiplayer',
  'Great Soundtrack',
  'Indie',
  'Controller',
  'Classic',
  'Early Access',
  'Free to Play',
  'Kickstarter',
  'Crowdfunded',
  'Remake',
  'Reboot',
  'Quick-Time Events',
  '3D Vision',
  'Moddable',
  'Steam Trading Cards',
]);

// Games that list single-player but are built around playing with others.
export const MULTIPLAYER_FOCUS = new Set([
  'PvE',
  'Multiplayer',
  'Massively Multiplayer',
  'MMORPG',
  'Battle Royale',
  'MOBA',
  'PvP',
  'Online Co-Op',
  'Co-op',
  'eSports',
  'Competitive',
  'Team-Based',
  'Hero Shooter',
  'Party Game',
  'Local Multiplayer',
]);

/** Steam orders tags by votes, so earlier tags describe a game better. */
export function tagWeight(index: number) {
  return 1 / (1 + index * 0.15);
}

export function topTags(tags: string[] | null, limit = 12): Map<string, number> {
  const out = new Map<string, number>();
  for (const tag of tags ?? []) {
    if (GENERIC_TAGS.has(tag)) continue;
    out.set(tag, tagWeight(out.size));
    if (out.size >= limit) break;
  }
  return out;
}

/** 0 to 1: how much the top tags are about playing with other people. */
export function multiplayerFocus(game: { categories: string[] | null; tags: string[] | null }) {
  if (game.categories?.includes('MMO')) return 1;
  const count = (game.tags ?? []).slice(0, 5).filter((t) => MULTIPLAYER_FOCUS.has(t)).length;
  return Math.min(1, count / 3);
}

/** Weighted overlap of two tag lists, 0 to 1. */
export function similarity(a: Map<string, number>, b: Map<string, number>) {
  let shared = 0;
  let total = 0;
  for (const [tag, wa] of a) {
    const wb = b.get(tag) ?? 0;
    shared += Math.min(wa, wb);
    total += Math.max(wa, wb);
  }
  for (const [tag, wb] of b) if (!a.has(tag)) total += wb;
  return total > 0 ? shared / total : 0;
}

/** "The Legend of Heroes: Trails of Cold Steel IV" → "legend of heroes: trails of cold steel". */
export function seriesKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(
      /\b(the|definitive|remastered|remaster|complete|goty|game of the year|enhanced|ultimate|deluxe|edition|director's cut|hd)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9:\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s:-]+(?:[ivx]{1,4}|\d{1,2})$/, '')
    .replace(/^[\s:-]+|[\s:-]+$/g, '');
}

/** The franchise part of a series key: "castlevania: lords of shadow" → "castlevania". */
export function franchiseKey(key: string) {
  return key.split(/\s*(?::|\s-\s)\s*/)[0];
}

export function startsWithWords(text: string, prefix: string) {
  return prefix.length >= 5 && (text === prefix || text.startsWith(`${prefix} `));
}

/** Same series (1), same franchise (0.5), or unrelated (0). */
export function seriesMatch(a: string, b: string) {
  const ka = seriesKey(a);
  const kb = seriesKey(b);
  if (!ka || !kb || a === b) return 0;
  if (ka === kb) return 1;
  const fa = franchiseKey(ka);
  const fb = franchiseKey(kb);
  if (fa === fb && fa.length >= 5) return 0.5;
  if (startsWithWords(kb, fa) || startsWithWords(ka, fb)) return 0.5;
  return 0;
}

// Edition words that don't make a different game.
export const EDITION_WORDS =
  /\b(the|definitive|remastered|remaster|complete|goty|game of the year|enhanced|ultimate|deluxe|edition|director's cut|hd|classic|anniversary)\b/g;

/**
 * Collapses editions of the same game: "Ori and the Blind Forest: Definitive
 * Edition" and "Ori and the Blind Forest" share a key. Unlike seriesKey it keeps
 * numbers, so "Portal" and "Portal 2" stay apart.
 */
export function editionKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(EDITION_WORDS, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

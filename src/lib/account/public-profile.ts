import type { LibraryPlatforms } from '@/lib/games/consoles';
import type { ActivityEntry, ActivityLine } from './activity';
import type { FavoriteGame } from './favorites';
import type { ProfileFigures } from './figures';

// What a profile shows to anyone, at /u/<username>. Everything a visitor's
// browser receives about the player is in here, so nothing private belongs in it:
// no email, no account or Steam id, no notes, and never the library itself.

/**
 * A row of Recent activity as other people are sent it: what the list draws of
 * an entry (ActivityEntry), without the game's id, which only the player's own
 * list has a use for (it opens the game).
 */
export interface PublicActivity {
  /** Unique in the list: its place in it, not the event it came from. */
  key: string;
  /** The game's name; "5 games" for several. */
  name: string;
  header_image: string | null;
  /** Where the game is played, for saying it after the line ("on Switch"). */
  source: string;
  platform: string | null;
  /** When the latest of it was logged: a moment, a day (from before the history), or ''. */
  at: string;
  lines: ActivityLine[];
  /** For a row that unfolds: each game's own row, or each of a game's updates. */
  games?: PublicActivity[];
  updates?: PublicActivity[];
}

export interface PublicProfile {
  username: string;
  /** The display name or the Steam name, when it can be shown to others; else the username. */
  name: string;
  avatar: string | null;
  /** "January 2026", or null when that isn't known. */
  figures: ProfileFigures;
  /** Finished games at each rating, 0 to 10; null until enough are rated. */
  ratings: number[] | null;
  /** In the order picked. */
  favorites: Omit<FavoriteGame, 'id'>[];
  /** Most games first. */
  platforms: { name: string; count: number }[];
  /** What those platforms come to, for saying where each game in the activity was played. */
  library: LibraryPlatforms;
  /** The highlights of what the player did, newest first (HIGHLIGHTS in ./activity). */
  activity: PublicActivity[];
}

/** The page's address for a username. */
export const publicProfilePath = (username: string) => `/u/${username}`;

/** The rows as they leave the server: only what the list draws, and no ids. */
export function publicActivity(entries: ActivityEntry[], under = ''): PublicActivity[] {
  return entries.map((entry, place) => {
    const key = `${under}${place}`;
    return {
      key,
      name: entry.name,
      header_image: entry.header_image,
      source: entry.source,
      platform: entry.platform,
      at: entry.at,
      lines: entry.lines,
      ...(entry.games ? { games: publicActivity(entry.games, `${key}-`) } : {}),
      ...(entry.updates ? { updates: publicActivity(entry.updates, `${key}-`) } : {}),
    };
  });
}

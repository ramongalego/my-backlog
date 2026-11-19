import { platformOf } from '@/lib/games/consoles';
import type { GameStatus } from '@/lib/games/status';
import { STATUS_STYLE } from '@/lib/games/status-style';

// Profile's Download your data. Built here from the rows the route reads, so
// what goes in a file is decided in one place.

export type ExportFormat = 'json' | 'csv';

/** A game as the database holds it: the columns that are the player's own. */
export interface ExportGameRow {
  id: number;
  name: string;
  source: string;
  platform: string | null;
  app_id: number | null;
  steam_app_id: number | null;
  status: GameStatus;
  rating: number | null;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  dropped_at: string | null;
  playtime_forever: number | null;
  last_played_at: string | null;
  created_at: string | null;
  header_image: string | null;
  art_chosen: boolean | null;
}

/** Everything the route reads for one player. */
export interface ExportRows {
  account: {
    email: string | null;
    createdAt: string | null;
    displayName: string | null;
    username: string | null;
    steamId: string | null;
    steamUsername: string | null;
  };
  games: ExportGameRow[];
  /** The queue and the favorites, as game ids with their place (0 first). */
  queue: { game_id: number; position: number }[];
  favorites: { game_id: number; position: number }[];
  insights: {
    tone: string;
    headline: string;
    paragraphs: unknown;
    signature: string;
    generated_at: string;
  }[];
  sharePages: {
    id: string;
    game_name: string;
    rating: number | null;
    playtime_minutes: number;
    created_at: string;
  }[];
  supportMessages: { type: string; message: string; created_at: string }[];
  /** The history of changes to the games (game_events), oldest first. */
  history: { game_id: number; kind: string; changes: unknown; created_at: string }[];
  /** What Pick My Game and Random picked (game_picks), oldest first. */
  picks: {
    game_id: number;
    kind: string;
    mode: string;
    mood: string | null;
    energy: string | null;
    time: string | null;
    attempt: number;
    reasoning: string | null;
    model: string | null;
    outcome: string | null;
    created_at: string;
    answered_at: string | null;
  }[];
}

export interface ExportedGame {
  id: number;
  name: string;
  /** Where it's played: a console, or PC for a game played on Steam. */
  platform: string | null;
  /** "steam" for a game from the Steam library, "manual" for one added by hand. */
  source: string;
  steamAppId: number | null;
  status: GameStatus;
  /** Out of 10. */
  rating: number | null;
  notes: string | null;
  /** When it was last started, to the second. */
  startedAt: string | null;
  /** The day it was finished or dropped, "YYYY-MM-DD". */
  finishedOn: string | null;
  droppedOn: string | null;
  playtimeMinutes: number;
  lastPlayedAt: string | null;
  addedAt: string | null;
  /** Its place in the queue and among the favorites, 1 first; null when it has none. */
  queuePosition: number | null;
  favoritePosition: number | null;
  /** The art picked with Choose art, when it isn't the game's own. */
  chosenArt: string | null;
}

export interface AccountExport {
  app: 'MyBacklog';
  /** Of this file's layout: raised when a field is renamed or removed. */
  version: 1;
  exportedAt: string;
  account: {
    email: string | null;
    name: string | null;
    username: string | null;
    memberSince: string | null;
    steam: { id: string; username: string | null } | null;
  };
  games: ExportedGame[];
  /** The profile and roast written for the player on Stats. */
  insights: {
    kind: string;
    headline: string;
    paragraphs: unknown;
    signature: string;
    writtenAt: string;
  }[];
  sharePages: {
    id: string;
    game: string;
    rating: number | null;
    playtimeMinutes: number;
    createdAt: string;
  }[];
  /** What the player sent through Report a problem. */
  supportMessages: { type: string; message: string; sentAt: string }[];
  /**
   * Oldest first, kept from November 2026. `changes` maps each changed value to
   * [before, after] (every before null for an "added"), hours in minutes, dates
   * in UTC. Changes within a minute are one entry, and an undone change leaves
   * none. Read time played with `playsOf` (lib/account/history.ts).
   */
  history: { gameId: number; kind: string; changes: unknown; at: string }[];
  /**
   * Pick My Game and Random, oldest first, kept from November 2026. `for` is
   * "queue" when a game was being played. `attempt` 2 is the pick after one
   * reroll. `outcome` is null when the picker closed without a choice, "unseen"
   * when it closed before the pick arrived.
   */
  picks: {
    gameId: number;
    kind: string;
    for: string;
    mood: string | null;
    energy: string | null;
    time: string | null;
    attempt: number;
    reason: string | null;
    model: string | null;
    outcome: string | null;
    at: string;
    answeredAt: string | null;
  }[];
}

/** A finish or drop date is saved as a day (midnight UTC): the day is read straight off it. */
const dayOf = (saved: string | null) => saved?.slice(0, 10) ?? null;

export function buildExport(rows: ExportRows, now = new Date()): AccountExport {
  const place = (list: { game_id: number; position: number }[]) =>
    new Map(
      [...list].sort((a, b) => a.position - b.position).map((row, i) => [row.game_id, i + 1]),
    );
  const queue = place(rows.queue);
  const favorites = place(rows.favorites);
  // Only of the games in the file: Steam also counts tools and soundtracks
  // as owned, and their hours change too.
  const listed = new Set(rows.games.map((game) => game.id));

  return {
    app: 'MyBacklog',
    version: 1,
    exportedAt: now.toISOString(),
    account: {
      email: rows.account.email,
      name: rows.account.displayName,
      username: rows.account.username,
      memberSince: rows.account.createdAt,
      steam: rows.account.steamId
        ? { id: rows.account.steamId, username: rows.account.steamUsername }
        : null,
    },
    games: rows.games.map((game) => ({
      id: game.id,
      name: game.name,
      platform: platformOf(game),
      source: game.source,
      steamAppId: game.app_id ?? game.steam_app_id,
      status: game.status,
      rating: game.rating,
      notes: game.notes,
      startedAt: game.started_at,
      finishedOn: dayOf(game.finished_at),
      droppedOn: dayOf(game.dropped_at),
      playtimeMinutes: game.playtime_forever ?? 0,
      lastPlayedAt: game.last_played_at,
      addedAt: game.created_at,
      queuePosition: queue.get(game.id) ?? null,
      favoritePosition: favorites.get(game.id) ?? null,
      chosenArt: game.art_chosen ? game.header_image : null,
    })),
    insights: rows.insights.map((insight) => ({
      kind: insight.tone,
      headline: insight.headline,
      paragraphs: insight.paragraphs,
      signature: insight.signature,
      writtenAt: insight.generated_at,
    })),
    sharePages: rows.sharePages.map((page) => ({
      id: page.id,
      game: page.game_name,
      rating: page.rating,
      playtimeMinutes: page.playtime_minutes,
      createdAt: page.created_at,
    })),
    supportMessages: rows.supportMessages.map((message) => ({
      type: message.type,
      message: message.message,
      sentAt: message.created_at,
    })),
    history: rows.history
      .filter((event) => listed.has(event.game_id))
      .map((event) => ({
        gameId: event.game_id,
        kind: event.kind,
        changes: event.changes,
        at: event.created_at,
      })),
    picks: rows.picks
      .filter((pick) => listed.has(pick.game_id))
      .map((pick) => ({
        gameId: pick.game_id,
        kind: pick.kind,
        for: pick.mode,
        mood: pick.mood,
        energy: pick.energy,
        time: pick.time,
        attempt: pick.attempt,
        reason: pick.reasoning,
        model: pick.model,
        outcome: pick.outcome,
        at: pick.created_at,
        answeredAt: pick.answered_at,
      })),
  };
}

/**
 * Text a spreadsheet would run as a formula (starting =, +, - or @) gets a
 * leading apostrophe: names and notes are typed in. The JSON keeps values as saved.
 */
function cell(value: string | number | null): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const CSV_COLUMNS: [string, (game: ExportedGame) => string | number | null][] = [
  ['Name', (game) => game.name],
  ['Platform', (game) => game.platform],
  ['Status', (game) => STATUS_STYLE[game.status]?.label ?? game.status],
  ['Rating', (game) => game.rating],
  ['Notes', (game) => game.notes],
  ['Started', (game) => dayOf(game.startedAt)],
  ['Finished', (game) => game.finishedOn],
  ['Dropped', (game) => game.droppedOn],
  // To a tenth of an hour, as the app shows it.
  ['Hours played', (game) => Math.round(game.playtimeMinutes / 6) / 10],
  ['Last played', (game) => dayOf(game.lastPlayedAt)],
  ['Added', (game) => dayOf(game.addedAt)],
  ['Queue position', (game) => game.queuePosition],
  ['Favorite', (game) => game.favoritePosition],
  ['Source', (game) => (game.source === 'steam' ? 'Steam' : 'Added by hand')],
  ['Steam app ID', (game) => game.steamAppId],
];

/**
 * Starts with a byte order mark, without which Excel misreads accents and
 * Japanese in names, and ends lines with CRLF as the CSV format asks.
 */
export function gamesCsv(games: ExportedGame[]): string {
  const byName = [...games].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  const lines = [
    CSV_COLUMNS.map(([title]) => title).join(','),
    ...byName.map((game) => CSV_COLUMNS.map(([, value]) => cell(value(game))).join(',')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** "mybacklog-games-2026-11-16.csv": what it is and the day it was made. */
export function exportFileName(format: ExportFormat, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return format === 'csv' ? `mybacklog-games-${day}.csv` : `mybacklog-data-${day}.json`;
}

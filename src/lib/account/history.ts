// Rules for reading game_events (written by triggers: see supabase/schema.sql),
// kept here once.

export interface HistoryEvent {
  /**
   * An event of one kind can carry the others' values too, when they changed in
   * the same sitting. `noted` says a note exists, never its words. Count a finish
   * by `finished_at` going to a new day, not by the status becoming "finished": a
   * game moved off Finished by mistake and back keeps its date, the same finish.
   */
  kind: 'added' | 'status' | 'edit' | 'queue' | 'favorite' | 'note' | 'playtime';
  /** Each value that changed, as [before, after]. Hours are in minutes. */
  changes: Record<string, [unknown, unknown]>;
  /** When it was logged, which can be days after it happened. */
  created_at: string;
}

interface Play {
  minutes: number;
  /** The last-played date where the event carries one, else when it was logged. */
  at: string;
}

/**
 * One game's events, in order. Time played is its hours total going up, except
 * the hours it arrives with, hours that change with the platform (the new
 * platform's total), and totals going down or to or from no value (corrections).
 * Callers leave out games whose `type` isn't "game": Steam's tools and
 * soundtracks have hours too. If Steam couldn't be asked when a game moved back
 * to it, its total arrives with the next sync and reads as played then.
 */
export function playsOf(events: readonly HistoryEvent[]): Play[] {
  const plays: Play[] = [];
  for (const event of events) {
    const hours = event.changes.playtime_forever;
    if (!hours || event.kind === 'added' || 'platform' in event.changes) continue;
    const [before, after] = hours;
    if (typeof before !== 'number' || typeof after !== 'number' || after <= before) continue;
    const playedOn = event.changes.last_played_at?.[1];
    plays.push({
      minutes: after - before,
      at: typeof playedOn === 'string' ? playedOn : event.created_at,
    });
  }
  return plays;
}

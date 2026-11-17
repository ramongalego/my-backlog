import 'server-only';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import type { PickMode, PickOutcome, SuggestionPreferences } from '@/lib/suggest/types';

// What Pick My Game and Random came up with is kept in game_picks, so the
// picks can be studied later: nothing reads it yet. Only the server writes it
// (with the secret key), a player reads their own rows. Keeping a pick is best
// effort: without the table or the key the pick is still made, just not kept,
// so nothing here throws.

/**
 * How long keeping a pick may take. A pick from the questions waits for its
 * row's id before it is shown, and a write that hangs must not hang the pick.
 */
const WRITE_TIMEOUT_MS = 3000;
/** The longest reason kept. The model is asked for a few sentences. */
const MAX_REASONING_LENGTH = 2000;

interface PickToRecord {
  userId: string;
  gameId: number;
  mode: PickMode;
  /** Which pick of the sitting: 1, then 2 after one reroll, and so on. */
  attempt: number;
  /** For a pick from the questions: the answers, the reason given and the model that gave it. */
  questions?: { answers: SuggestionPreferences; reasoning: string; model: string };
  /** What the player did with it, when that is already known (Home's Random starts its game). */
  outcome?: PickOutcome;
}

/** Keeps a pick. Returns its id, or null when it couldn't be kept. */
export async function recordPick(pick: PickToRecord): Promise<number | null> {
  try {
    const db = tryCreateServiceClient();
    if (!db) return null;
    // Both times from this server's clock, so the time taken to choose is
    // never measured between two clocks.
    const now = new Date().toISOString();
    const { data, error } = await db
      .from('game_picks')
      .insert({
        // From the session, never from the request: the row is the signed-in
        // player's, and the table refuses a game that isn't theirs.
        user_id: pick.userId,
        game_id: pick.gameId,
        kind: pick.questions ? 'questions' : 'random',
        mode: pick.mode,
        mood: pick.questions?.answers.mood ?? null,
        energy: pick.questions?.answers.energy ?? null,
        time: pick.questions?.answers.time ?? null,
        attempt: pick.attempt,
        reasoning: pick.questions?.reasoning.slice(0, MAX_REASONING_LENGTH) ?? null,
        model: pick.questions?.model ?? null,
        outcome: pick.outcome ?? null,
        created_at: now,
        answered_at: pick.outcome ? now : null,
      })
      .select('id')
      .abortSignal(AbortSignal.timeout(WRITE_TIMEOUT_MS))
      .single();
    if (error) {
      console.error('Failed to record a pick:', error.message);
      return null;
    }
    return typeof data?.id === 'number' ? data.id : null;
  } catch (err) {
    console.error('Failed to record a pick:', err);
    return null;
  }
}

/**
 * Keeps what the player did with a pick. The first answer stands: a pick
 * already answered is left as it is, so a repeated request changes nothing.
 * Only ever the signed-in player's own pick (`userId` is from the session),
 * and with `gameId`, only a pick of that game.
 */
export async function recordPickOutcome(
  userId: string,
  pickId: number,
  outcome: PickOutcome,
  gameId?: number,
): Promise<void> {
  try {
    const db = tryCreateServiceClient();
    if (!db) return;
    let update = db
      .from('game_picks')
      .update({ outcome, answered_at: new Date().toISOString() })
      .eq('id', pickId)
      .eq('user_id', userId)
      .is('outcome', null);
    if (gameId !== undefined) update = update.eq('game_id', gameId);
    const { error } = await update.abortSignal(AbortSignal.timeout(WRITE_TIMEOUT_MS));
    if (error) console.error('Failed to record what was done with a pick:', error.message);
  } catch (err) {
    console.error('Failed to record what was done with a pick:', err);
  }
}

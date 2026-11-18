import { z } from 'zod';

// What the owner's usage page shows: the answer of the usage_stats database
// function, checked on arrival.
const count = z.number().int().nonnegative();
/** The answers given most to one question, most first. */
const answers = z.array(z.object({ answer: z.string(), picks: count }));

export const usageSchema = z.object({
  players: count,
  steamConnected: count,
  withGames: count,
  activeDay: count,
  activeWeek: count,
  activeMonth: count,
  cameBack: count,
  signups: z.object({ email: count, google: count, discord: count, unconfirmed: count }),
  libraries: z.object({
    medianGames: count,
    steamGames: count,
    manualGames: count,
    /** Players whose games were all added by hand. */
    manualOnly: count,
  }),
  /** Players who have used each, ever, or have it now where only the present is kept. */
  features: z.object({
    queue: count,
    favorites: count,
    notes: count,
    ratings: count,
    addedByHand: count,
    chosenArt: count,
    shareCards: count,
    nameOrPicture: count,
    profile: count,
    roast: count,
  }),
  /** The last 30 days. */
  pickMyGame: z.object({
    questions: count,
    random: count,
    played: count,
    queued: count,
    rerolled: count,
    closed: count,
    moods: answers,
    energies: answers,
    times: answers,
  }),
  /** The last 8 weeks (Monday to Sunday, UTC), this week first. */
  weeks: z.array(
    z.object({
      start: z.string(),
      signups: count,
      active: count,
      picks: count,
      finishes: count,
    }),
  ),
  month: z.object({
    picks: count,
    picksTaken: count,
    pickers: count,
    finishes: count,
    finishers: count,
    insightWriters: count,
    supportTickets: count,
  }),
});

export type Usage = z.infer<typeof usageSchema>;

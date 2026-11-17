import 'server-only';

/**
 * The OpenAI model for everything the app writes: Pick My Game's reasons and
 * the player profile on Stats. Compared against gpt-4o-mini and five others
 * on the same prompts, it follows the writing rules far more closely and
 * costs about a third less. Its reasoning is off wherever it's used: the
 * app works out the facts and the model only writes.
 */
export const AI_MODEL = 'gpt-6-luna';

/**
 * How long one request to the model may take, and none of the SDK's own
 * retries: its defaults are ten minutes and two silent retries, on top of the
 * one retry each route already makes. An answer here takes a few seconds.
 */
export const OPENAI_OPTIONS = { timeout: 20_000, maxRetries: 0 };

// What the app can spend on OpenAI is capped in two places.
//
// The cap itself is on OpenAI's side: the project's monthly spend limit with
// "Enforce a hard limit" turned on (OpenAI dashboard, the project's Limits).
// Past it OpenAI refuses every request, whatever sent it, which no check in
// here could promise: it also covers a bug in this code and a leaked key.
//
// The app's own brake is the daily counts in rate-limit.ts (a player's picks
// and profiles, and everyone's together), which keep one account, or a crowd
// of them, from using the month's budget in a day. At `AI_MODEL`'s price
// (Nov 2026: $0.10 per million tokens in, $0.50 out) a pick is about a
// twentieth of a cent: one for a library of 200 games measured 3,900 tokens
// in and 90 out. Every pick the daily counts allow, at that size, comes to
// about $45 a month. If each one were as long as the prompt limit lets it be
// and had to be asked twice, with the profiles too, it would be about $350.

/**
 * The codes OpenAI refuses with when there is no money left to spend: the
 * project's or the organization's spend limit was reached, or its prepaid
 * credit ran out.
 */
const OUT_OF_BUDGET = new Set([
  'project_spend_limit_exceeded',
  'organization_spend_limit_exceeded',
  'credit_balance_exhausted',
  'insufficient_quota',
  'billing_hard_limit_reached',
]);

/**
 * Whether OpenAI refused a request because the budget is spent. Asking again
 * can't help until the limit resets or is raised, unlike its other refusals
 * (a rate limit is a 429 too), so a route stops there and says so.
 */
export function isOutOfBudget(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, type } = error as { code?: unknown; type?: unknown };
  return [code, type].some((value) => typeof value === 'string' && OUT_OF_BUDGET.has(value));
}

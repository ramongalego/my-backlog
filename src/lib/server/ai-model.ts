import 'server-only';

/**
 * Chosen over gpt-4o-mini and five others: it follows the writing rules far
 * more closely for about a third less. Reasoning is off wherever it's used:
 * the app works out the facts and the model only writes.
 */
export const AI_MODEL = 'gpt-6-luna';

/**
 * Timeout in ms. The SDK's defaults are ten minutes and two silent retries, on
 * top of the retry each route makes; an answer takes a few seconds.
 */
export const OPENAI_OPTIONS = { timeout: 20_000, maxRetries: 0 };

// The spending cap is the OpenAI project's monthly limit with "Enforce a hard
// limit" on, which also covers a bug here or a leaked key. The daily counts in
// rate-limit.ts keep one account, or many, from spending the month in a day:
// every pick they allow comes to about $45 a month, at most about $350.

/** The project's or organization's spend limit was reached, or prepaid credit ran out. */
const OUT_OF_BUDGET = new Set([
  'project_spend_limit_exceeded',
  'organization_spend_limit_exceeded',
  'credit_balance_exhausted',
  'insufficient_quota',
  'billing_hard_limit_reached',
]);

/**
 * Asking again can't help until the limit resets or is raised, unlike OpenAI's
 * other refusals (a rate limit is a 429 too), so a route stops and says so.
 */
export function isOutOfBudget(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, type } = error as { code?: unknown; type?: unknown };
  return [code, type].some((value) => typeof value === 'string' && OUT_OF_BUDGET.has(value));
}

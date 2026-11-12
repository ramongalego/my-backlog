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

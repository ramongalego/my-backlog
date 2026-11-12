// Bounds on what a player's library can put into a prompt. A player can write
// their own games' rows directly (row-level security lets them), so a name, a
// tag or a list of genres can be any length. Each request to the model is paid
// for by its size: these keep one row from turning into a very large prompt.

/** A game's name. Real ones are well under this; the database allows 500. */
const MAX_NAME_CHARS = 120;
/** A tag or a genre. Steam's longest are about 30 characters. */
const MAX_LABEL_CHARS = 40;
/** Tags or genres listed for one game. */
const MAX_LABELS = 6;

/**
 * The most text one request sends to the model. Real prompts are a fraction of
 * this; past it the request is refused rather than sent.
 */
export const MAX_PROMPT_CHARS = 40_000;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

export const clipName = (name: string) => clip(name, MAX_NAME_CHARS);

/** A game's first few tags or genres, each kept to a sensible length. */
export const clipLabels = (labels: string[]) =>
  labels.slice(0, MAX_LABELS).map((label) => clip(label, MAX_LABEL_CHARS));

/** JSON for a prompt, with every string in it kept to a name's length. */
export const boundedJson = (value: unknown) =>
  JSON.stringify(value, (_key, v) => (typeof v === 'string' ? clipName(v) : v));

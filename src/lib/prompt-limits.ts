// A player can write their own rows directly (row-level security lets them), so
// a name or tag can be any length, and each model request is paid for by size.

/** A game's name. Real ones are well under this; the database allows 500. */
const MAX_NAME_CHARS = 120;
/** A tag or a genre. Steam's longest are about 30 characters. */
const MAX_LABEL_CHARS = 40;
const MAX_LABELS = 6;

/** Past this the request is refused, not sent. Real prompts are a fraction of it. */
export const MAX_PROMPT_CHARS = 40_000;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

export const clipName = (name: string) => clip(name, MAX_NAME_CHARS);

export const clipLabels = (labels: string[]) =>
  labels.slice(0, MAX_LABELS).map((label) => clip(label, MAX_LABEL_CHARS));

export const boundedJson = (value: unknown) =>
  JSON.stringify(value, (_key, v) => (typeof v === 'string' ? clipName(v) : v));

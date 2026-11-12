/**
 * Text as search compares it: lower case and without accents, so "pokemon"
 * finds Pokémon and "okami" finds Ōkami.
 */
function searchable(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Names and tags as search compares them, kept between keystrokes: a search
// runs over the whole library (and every game's tags) each time the text
// changes. Only library text is kept, never what's typed, so it can't grow
// past the library's own names and tags.
const prepared = new Map<string, string>();
function searchableOnce(text: string): string {
  let value = prepared.get(text);
  if (value === undefined) {
    value = searchable(text);
    prepared.set(text, value);
  }
  return value;
}

/** Whether a game's name or one of its tags contains the search text. */
export function matchesSearch(game: { name: string; tags?: string[] | null }, query: string) {
  const q = searchable(query.trim());
  if (!q) return true;
  return (
    searchableOnce(game.name).includes(q) ||
    (game.tags ?? []).some((t) => searchableOnce(t).includes(q))
  );
}

/**
 * Whether the search text is in the game's name, not just one of its tags:
 * those come first, so "metroid" lists the Metroid games before every other
 * Metroidvania.
 */
export function nameMatchesSearch(game: { name: string }, query: string) {
  const q = searchable(query.trim());
  return !!q && searchableOnce(game.name).includes(q);
}

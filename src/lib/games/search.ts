/** Without accents, so "pokemon" finds Pokémon. */
function searchable(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Kept between keystrokes, as each search runs over every name and tag. Only
// library text is kept, never what's typed, so it can't outgrow the library.
const prepared = new Map<string, string>();
function searchableOnce(text: string): string {
  let value = prepared.get(text);
  if (value === undefined) {
    value = searchable(text);
    prepared.set(text, value);
  }
  return value;
}

export function matchesSearch(game: { name: string; tags?: string[] | null }, query: string) {
  const q = searchable(query.trim());
  if (!q) return true;
  return (
    searchableOnce(game.name).includes(q) ||
    (game.tags ?? []).some((t) => searchableOnce(t).includes(q))
  );
}

/** Name matches are listed first, so "metroid" puts Metroid before every Metroidvania. */
export function nameMatchesSearch(game: { name: string }, query: string) {
  const q = searchable(query.trim());
  return !!q && searchableOnce(game.name).includes(q);
}

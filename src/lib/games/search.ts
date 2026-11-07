/**
 * Text as search compares it: lower case and without accents, so "pokemon"
 * finds Pokémon and "okami" finds Ōkami.
 */
function searchable(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Whether a game's name or one of its tags contains the search text. */
export function matchesSearch(game: { name: string; tags?: string[] | null }, query: string) {
  const q = searchable(query.trim());
  if (!q) return true;
  return (
    searchable(game.name).includes(q) || (game.tags ?? []).some((t) => searchable(t).includes(q))
  );
}

/**
 * Whether the search text is in the game's name, not just one of its tags:
 * those come first, so "metroid" lists the Metroid games before every other
 * Metroidvania.
 */
export function nameMatchesSearch(game: { name: string }, query: string) {
  const q = searchable(query.trim());
  return !!q && searchable(game.name).includes(q);
}

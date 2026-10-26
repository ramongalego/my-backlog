import { parseReleaseDate } from './release-date';
import { EDITION_WORDS, editionKey } from './similarity';

/**
 * Series you can start anywhere, so an older entry waiting in the backlog
 * never holds a newer one back: each game tells its own story, or (The
 * Witcher) nearly everyone starts with the later one. Direct sequels inside
 * them (Final Fantasy VII Rebirth) are left to the model, which knows the
 * stories. Titles are compared without "the", so entries leave it out too.
 */
const STANDALONE_SERIES = [
  'final fantasy',
  'dragon quest',
  'persona',
  'shin megami tensei',
  'tales of',
  'far cry',
  'grand theft auto',
  'monster hunter',
  'need for speed',
  'forza',
  'call of duty',
  'battlefield',
  'civilization',
  'total war',
  'sims',
  'football manager',
  'witcher',
];

const ROMAN: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
  xiii: 13,
  xiv: 14,
  xv: 15,
  xvi: 16,
};

type Token = { word: string } | { num: number } | { sep: true };

interface Entry {
  words: string[];
  tokens: Token[];
  number: number | null;
  released: number | null;
  edition: string;
}

/**
 * Splits a title into words, entry numbers and subtitle separators:
 * "Hyperdimension Neptunia Re;Birth2 Sisters Generation" gives the words
 * "hyperdimension neptunia re birth", the number 2, then "sisters generation".
 * Edition words are dropped and four-digit numbers stay words, so "Metro 2033"
 * isn't entry 2033 and "Football Manager 2023" isn't a sequel of 2022.
 */
function tokenize(name: string): Token[] {
  const text = name
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s[-–—]\s|:/g, ' | ')
    .replace(EDITION_WORDS, ' ');
  const tokens: Token[] = [];
  for (const raw of text.match(/[a-z0-9]+|\|/g) ?? []) {
    if (raw === '|') {
      if (tokens.length && !('sep' in tokens[tokens.length - 1])) tokens.push({ sep: true });
      continue;
    }
    const attached = /^([a-z]+)(\d{1,2})$/.exec(raw);
    if (attached) {
      tokens.push({ word: attached[1] }, { num: Number(attached[2]) });
    } else if (/^\d{1,2}$/.test(raw)) {
      tokens.push({ num: Number(raw) });
    } else if (tokens.length && ROMAN[raw]) {
      tokens.push({ num: ROMAN[raw] });
    } else {
      tokens.push({ word: raw });
    }
  }
  return tokens;
}

function parse(game: { name: string; release_date?: string | null }): Entry {
  const tokens = tokenize(game.name);
  const words = tokens.flatMap((t) => ('word' in t ? [t.word] : []));
  const first = tokens.find((t) => 'num' in t);
  return {
    words,
    tokens,
    number: first && 'num' in first ? first.num : null,
    released: parseReleaseDate(game.release_date),
    edition: editionKey(game.name),
  };
}

/**
 * Whether two titles are entries of one series: the same words once numbers
 * are dropped ("Trails of Cold Steel" and "Trails of Cold Steel IV"), or one
 * title continuing the other after a number or subtitle ("The Witcher" and
 * "The Witcher 3: Wild Hunt"). "Portal Knights" isn't a Portal game: nothing
 * marks where Portal ends.
 */
function sameSeries(a: Entry, b: Entry) {
  if (a.edition === b.edition || !a.words.length || !b.words.length) return false;
  const [short, long] = a.words.length <= b.words.length ? [a, b] : [b, a];
  if (short.words.join(' ').length < 4) return false;
  if (!short.words.every((w, i) => long.words[i] === w)) return false;
  if (short.words.length === long.words.length) return true;

  // The token right after the shared words must be a number or a separator.
  let seen = 0;
  for (const token of long.tokens) {
    if (seen === short.words.length) return !('word' in token);
    if ('word' in token) seen++;
  }
  return false;
}

/** Whether `a` comes before `b`: by entry number when either has one, else by release date. */
function comesBefore(a: Entry, b: Entry) {
  if (a.number !== null || b.number !== null) {
    const na = a.number ?? 1;
    const nb = b.number ?? 1;
    if (na !== nb) return na < nb;
  }
  return a.released !== null && b.released !== null && a.released < b.released;
}

function isStandalone(entry: Entry) {
  const title = entry.words.join(' ');
  return STANDALONE_SERIES.some((s) => title === s || title.startsWith(`${s} `));
}

/**
 * Drops games whose earlier entry is also in the list, so a sequel isn't
 * suggested while the game before it is still waiting in the backlog
 * (Neptunia Re;Birth2 while Re;Birth1 is unplayed). Series whose entries
 * stand alone are left alone.
 */
export function withoutLaterEntries<T extends { name: string; release_date?: string | null }>(
  games: T[],
): T[] {
  const entries = games.map(parse);
  // Entries of a series always share their first word, so only compare those.
  const byFirstWord = new Map<string, number[]>();
  entries.forEach((e, i) => {
    if (!e.words.length || isStandalone(e)) return;
    const list = byFirstWord.get(e.words[0]) ?? [];
    list.push(i);
    byFirstWord.set(e.words[0], list);
  });

  const later = new Set<number>();
  for (const group of byFirstWord.values()) {
    for (const i of group) {
      for (const j of group) {
        if (i !== j && sameSeries(entries[i], entries[j]) && comesBefore(entries[j], entries[i])) {
          later.add(i);
          break;
        }
      }
    }
  }
  return games.filter((_, i) => !later.has(i));
}

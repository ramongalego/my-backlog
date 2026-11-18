/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadLibraryMeta } from '@/lib/data/loaders';

interface Game {
  source: 'steam' | 'manual';
  platform: string | null;
  status: string;
  type: string;
}
let library: Game[];

/**
 * The games table, filtered as the loader asks: only the filters it uses, so
 * a filter it stops sending (or a new one) fails a test here.
 */
const supabase = {
  from: () => {
    const tests: ((game: Game) => boolean)[] = [];
    let head = false;
    let range: [number, number] | null = null;
    const or = (clause: string) => (game: Game) =>
      clause.split(',').some((part) => {
        const [column, op, ...rest] = part.split('.');
        const value = rest.join('.');
        const actual = game[column as keyof Game];
        if (op === 'is' && value === 'null') return actual === null;
        if (op === 'eq') return actual === value;
        if (op === 'neq') return actual !== null && actual !== value;
        throw new Error(`Unexpected filter ${part}`);
      });
    const builder = {
      select: (_columns: string, options?: { head?: boolean }) => {
        head = !!options?.head;
        return builder;
      },
      eq: (column: keyof Game | 'user_id', value: string) => {
        if (column !== 'user_id') tests.push((game) => game[column] === value);
        return builder;
      },
      neq: (column: keyof Game, value: string) => {
        tests.push((game) => game[column] !== value);
        return builder;
      },
      in: (column: keyof Game, values: string[]) => {
        tests.push((game) => values.includes(game[column] as string));
        return builder;
      },
      or: (clause: string) => {
        tests.push(or(clause));
        return builder;
      },
      order: () => builder,
      range: (from: number, to: number) => {
        range = [from, to];
        return builder;
      },
      then: (resolve: (value: unknown) => unknown) => {
        const rows = library.filter((game) => tests.every((test) => test(game)));
        if (head) return resolve({ count: rows.length, error: null });
        const page = range ? rows.slice(range[0], range[1] + 1) : rows;
        return resolve({ data: page.map(({ platform }) => ({ platform })), error: null });
      },
    };
    return builder;
  },
} as unknown as SupabaseClient;

const games = (count: number, game: Partial<Game>): Game[] =>
  Array.from({ length: count }, () => ({
    source: 'steam',
    platform: 'PC',
    status: 'backlog',
    type: 'game',
    ...game,
  }));

beforeEach(() => {
  library = [];
});

describe("the library's platforms", () => {
  it('counts Steam games, games added by hand and Steam games moved to a console', async () => {
    library = [
      ...games(5, { source: 'steam', platform: 'PC' }),
      ...games(2, { source: 'steam', platform: null }),
      ...games(3, { source: 'manual', platform: 'Switch 2' }),
      ...games(1, { source: 'steam', platform: 'Switch 2' }),
      ...games(2, { source: 'manual', platform: 'PC' }),
    ];
    const { platforms } = await loadLibraryMeta(supabase, 'user-1');
    // PC: five on Steam, two with no platform saved (Steam's), two added by hand.
    expect(platforms).toEqual({ main: 'PC', count: 2 });
  });

  it('is mainly a console when most of the library is on it', async () => {
    library = [...games(2, {}), ...games(9, { source: 'manual', platform: 'PS5' })];
    expect((await loadLibraryMeta(supabase, 'user-1')).platforms).toEqual({
      main: 'PS5',
      count: 2,
    });
  });

  it("doesn't count hidden games, tools, or games on no platform", async () => {
    library = [
      ...games(3, { source: 'manual', platform: 'Switch' }),
      ...games(9, { status: 'hidden' }),
      ...games(9, { type: 'software' }),
      ...games(4, { source: 'manual', platform: null }),
    ];
    expect((await loadLibraryMeta(supabase, 'user-1')).platforms).toEqual({
      main: 'Switch',
      count: 1,
    });
  });

  it('is nothing for an empty library', async () => {
    expect((await loadLibraryMeta(supabase, 'user-1')).platforms).toEqual({
      main: null,
      count: 0,
    });
  });
});

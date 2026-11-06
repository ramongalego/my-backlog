/**
 * @jest-environment node
 */
// A live check, not a unit test: looks real games up on HowLongToBeat the way
// the app does, to catch the day HLTB changes its site and the lookup stops
// working. Run with `npm run check:hltb`; a scheduled GitHub Action runs it
// daily (.github/workflows/hltb-check.yml). `npm test` leaves it out.
import { getMainStoryHours } from '@/lib/hltb/api';

// Well-known games with steady times, and the range their main story is in.
const GAMES: [name: string, min: number, max: number][] = [
  ['Portal 2', 6, 12],
  ['Celeste', 6, 12],
  ['Hollow Knight', 20, 35],
];

// Anything the lookup logs is a sign of trouble even when a time still comes
// back: e.g. the search endpoint not found in HLTB's scripts, so the fallback
// was used, which works only until HLTB renames it.
const errors: string[] = [];
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
});

it.each(GAMES)(
  'finds the main story time for %s',
  async (name, min, max) => {
    const hours = await getMainStoryHours(name);
    expect({ name, hours, errors }).toEqual({
      name,
      hours: expect.any(Number),
      errors: [],
    });
    expect(hours).toBeGreaterThanOrEqual(min);
    expect(hours).toBeLessThanOrEqual(max);
  },
  // Generous: finding the search endpoint can mean fetching several of HLTB's
  // scripts, each allowed 10s, before the searches themselves.
  120_000,
);

import { publicActivity, publicProfilePath } from './public-profile';
import type { ActivityEntry } from './activity';

const entry = (over: Partial<ActivityEntry> = {}): ActivityEntry => ({
  key: 'event-12',
  id: 7,
  name: 'Hades',
  header_image: 'https://example.com/hades.jpg',
  source: 'steam',
  platform: 'PC',
  lines: [{ kind: 'finished', rating: 9 }],
  day: '2026-11-17',
  at: '2026-11-17T20:00:00+00:00',
  rating: 9,
  ...over,
});

it('keeps what the list draws of a row, and none of the ids it came from', () => {
  expect(publicActivity([entry()])).toEqual([
    {
      key: '0',
      name: 'Hades',
      header_image: 'https://example.com/hades.jpg',
      source: 'steam',
      platform: 'PC',
      at: '2026-11-17T20:00:00+00:00',
      lines: [{ kind: 'finished', rating: 9 }],
    },
  ]);
});

it('keeps the rows a folded row unfolds to, each without ids too', () => {
  const games = ['Hades', 'Celeste', 'Tunic', 'Hollow Knight'].map((name, id) =>
    entry({ id, name, key: `event-${id}` }),
  );
  const updates = [
    entry({ key: 'event-31' }),
    entry({ key: 'event-30', lines: [{ kind: 'started' }] }),
  ];
  const [bulk, run] = publicActivity([
    entry({
      key: 'bulk-event-0',
      name: '4 games',
      lines: [{ kind: 'finished' }],
      rating: null,
      games,
    }),
    entry({ key: 'updates-event-30', updates }),
  ]);
  expect(bulk.games!.map((one) => [one.key, one.name])).toEqual([
    ['0-0', 'Hades'],
    ['0-1', 'Celeste'],
    ['0-2', 'Tunic'],
    ['0-3', 'Hollow Knight'],
  ]);
  expect(run.updates!.map((one) => [one.key, one.lines[0].kind])).toEqual([
    ['1-0', 'finished'],
    ['1-1', 'started'],
  ]);
  const sent = JSON.stringify([bulk, run]);
  expect(sent).not.toContain('event-');
  expect(sent).not.toContain('"id"');
  expect(sent).not.toContain('"day"');
});

it('gives every row a key of its own', () => {
  const rows = publicActivity(Array.from({ length: 12 }, () => entry()));
  expect(new Set(rows.map((row) => row.key)).size).toBe(12);
});

it('gives a profile its address', () => {
  expect(publicProfilePath('mist_kai-7')).toBe('/u/mist_kai-7');
});

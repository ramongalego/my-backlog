import { playedALot, type PlayedGame } from '@/lib/games/played-a-lot';

let nextId = 1;
const game = (
  name: string,
  hoursPlayed: number,
  overrides: Partial<PlayedGame> = {},
): PlayedGame & { name: string } => ({
  app_id: nextId++,
  name,
  status: 'backlog',
  playtime_forever: hoursPlayed * 60,
  main_story_hours: 20,
  categories: ['Single-player'],
  tags: ['Adventure'],
  ...overrides,
});

const names = (games: { name: string }[]) => games.map((g) => g.name);

it('lists games played past most of their story, and open-ended games with many hours', () => {
  const games = [
    game('Stardew Valley', 162, { main_story_hours: 53 }),
    game('PUBG', 455, { categories: ['Multi-player'], tags: ['Battle Royale', 'PvP'] }),
    game('No story time', 12, { main_story_hours: null }),
    game('Halfway', 10),
    game('Short multiplayer session', 3, { categories: ['Multi-player'] }),
  ];
  expect(names(playedALot(games))).toEqual(['PUBG', 'Stardew Valley', 'No story time']);
});

it('leaves out queued games and games that already have another status', () => {
  const queued = game('Queued', 30);
  const games = [queued, game('Finished', 30, { status: 'finished' }), game('Still backlog', 30)];
  expect(names(playedALot(games, new Set([queued.app_id])))).toEqual(['Still backlog']);
});

it('shows at most 5, most played first', () => {
  const games = [1, 2, 3, 4, 5, 6].map((h) => game(`Game ${h}`, 20 + h));
  expect(names(playedALot(games))).toEqual(['Game 6', 'Game 5', 'Game 4', 'Game 3', 'Game 2']);
});

import { playedHours } from '@/lib/games/playtime';

it('shows a tenth of an hour under 10 hours, so half an hour entered still shows', () => {
  expect(playedHours(0)).toBe(0);
  expect(playedHours(20)).toBe(0.3);
  expect(playedHours(390)).toBe(6.5);
  expect(playedHours(540)).toBe(9);
});

it('rounds to whole hours from 10', () => {
  expect(playedHours(600)).toBe(10);
  expect(playedHours(7830)).toBe(131);
});

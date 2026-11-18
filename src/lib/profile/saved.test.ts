import { factsSignature, playerFacts } from '@/lib/profile/facts';
import { insightSignature, writtenOn } from '@/lib/profile/saved';
import type { GameItem } from '@/lib/data/loaders';

const game = (overrides: Partial<GameItem>): GameItem =>
  ({
    id: Math.random(),
    source: 'steam',
    name: 'Game',
    status: 'finished',
    playtime_forever: 600,
    rating: 4,
    tags: ['RPG'],
    ...overrides,
  }) as GameItem;

describe('insightSignature', () => {
  it('signs a profile with the prompt version as well as the facts', () => {
    const facts = playerFacts(Array.from({ length: 12 }, () => game({})))!;
    expect(insightSignature(facts)).toMatch(/^v\d+:/);
    expect(insightSignature(facts)).toContain(factsSignature(facts));
  });

  it("counts won't-play games, so it must be given the whole library", () => {
    const library = Array.from({ length: 12 }, () => game({}));
    const withWontPlay = [...library, game({ status: 'wont_play' })];
    expect(insightSignature(playerFacts(withWontPlay)!)).not.toBe(
      insightSignature(playerFacts(library)!),
    );
  });
});

describe('writtenOn', () => {
  const now = new Date(2026, 10, 18);

  it('says the day, without the year, for this year', () => {
    expect(writtenOn(new Date(2026, 10, 7, 15).toISOString(), now)).toBe('November 7');
  });

  it('adds the year for another year', () => {
    expect(writtenOn(new Date(2025, 11, 30, 15).toISOString(), now)).toBe('December 30, 2025');
  });
});

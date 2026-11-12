import { boundedJson, clipLabels, clipName, MAX_PROMPT_CHARS } from '@/lib/prompt-limits';
import { buildSuggestionMessages } from '@/lib/suggest/prompt';
import { buildInsightMessages } from '@/lib/profile/prompt';
import { playerFacts } from '@/lib/profile/facts';
import type { GameItem } from '@/lib/data/loaders';
import type { SuggestionContext } from '@/lib/suggest/types';

const HUGE = 'x'.repeat(200_000);

describe('clipping', () => {
  it('leaves real names and tags alone', () => {
    const name = 'The Legend of Heroes: Trails of Cold Steel IV';
    expect(clipName(name)).toBe(name);
    expect(clipLabels(['JRPG', 'Turn-Based Combat'])).toEqual(['JRPG', 'Turn-Based Combat']);
  });

  it('cuts an oversized name or tag short, and a long list down to a few', () => {
    expect(clipName(HUGE).length).toBeLessThan(130);
    const labels = clipLabels(Array.from({ length: 500 }, () => HUGE));
    expect(labels).toHaveLength(6);
    expect(labels[0].length).toBeLessThan(50);
  });

  it('bounds every string inside JSON', () => {
    const json = boundedJson({ name: HUGE, nested: [{ tag: HUGE }], count: 3 });
    expect(json.length).toBeLessThan(400);
    expect(JSON.parse(json).count).toBe(3);
  });
});

// A player can write their own rows directly, so a row can hold anything. One
// stuffed row must not become a prompt the size of the model's whole context.
describe('a library stuffed with oversized text', () => {
  const stuffed = (id: number): GameItem =>
    ({
      id,
      source: 'steam',
      app_id: id,
      name: HUGE,
      status: id % 2 ? 'finished' : 'backlog',
      playtime_forever: 600,
      main_story_hours: 10,
      tags: Array.from({ length: 300 }, (_, i) => `${HUGE}${i}`),
      rating: 9,
      finished_at: '2026-01-01',
      header_image: null,
      release_date: 'Sep 28, 2010',
      critic_score: 60,
      created_at: '2026-01-01',
    }) as unknown as GameItem;

  it('still makes a small player-profile prompt', () => {
    const facts = playerFacts(Array.from({ length: 40 }, (_, i) => stuffed(i + 1)))!;
    for (const tone of ['profile', 'roast'] as const) {
      const size = buildInsightMessages(facts, tone).reduce((n, m) => n + m.content.length, 0);
      expect(size).toBeLessThan(MAX_PROMPT_CHARS);
    }
  });

  it('still makes a small Pick My Game prompt', () => {
    const game = { ...stuffed(1), genres: Array.from({ length: 300 }, () => HUGE) };
    const context = {
      preferences: { mood: 'relaxed', energy: 'low', time: 'short' },
      candidates: Array.from({ length: 12 }, (_, i) => ({
        game: { ...game, id: i + 1 },
        score: 1,
        series: { name: HUGE, status: 'finished', rating: 9 },
        similarTo: [{ name: HUGE, status: 'finished', rating: 8 }],
        similarToDropped: { name: HUGE, status: 'dropped', rating: null },
        recentlySkipped: false,
        outsideTimeRange: false,
      })),
      finishedGames: Array.from({ length: 25 }, () => ({ name: HUGE, rating: 9 })),
      droppedGames: Array.from({ length: 10 }, () => HUGE),
      previousReasonings: [],
    } as unknown as SuggestionContext;

    const size = buildSuggestionMessages(context).reduce((n, m) => n + m.content.length, 0);
    expect(size).toBeLessThan(MAX_PROMPT_CHARS);
  });
});

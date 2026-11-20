import { render } from '@testing-library/react';
import { ActivityWhat } from '@/components/profile/ActivityWhat';
import type { ActivityLine } from '@/lib/account/activity';

const said = (line: ActivityLine, platform?: string | null) => {
  const { container } = render(<ActivityWhat line={line} platform={platform} />);
  return container.textContent;
};

describe('a finish, with whatever came with it', () => {
  it.each<[string, ActivityLine, string | null]>([
    ['Finished', { kind: 'finished' }, null],
    ['Finished (PC)', { kind: 'finished' }, 'PC'],
    ['Finished and rated it 9/10', { kind: 'finished', rating: 9 }, null],
    ['Finished and rated it 9/10 (PC)', { kind: 'finished', rating: 9 }, 'PC'],
    // How long it took comes before the rating; the platform is last.
    [
      'Finished in 42h and rated it 9/10 (Switch 2)',
      { kind: 'finished', rating: 9, minutes: 2520 },
      'Switch 2',
    ],
    ['Finished in 1h 30m', { kind: 'finished', minutes: 90 }, null],
    ['Finished in 45m (PC)', { kind: 'finished', minutes: 45 }, 'PC'],
  ])('reads "%s"', (sentence, line, platform) => {
    expect(said(line, platform)).toBe(sentence);
  });
});

describe('everything else that can be done to a game', () => {
  it.each<[string, ActivityLine, string | null | undefined]>([
    ['Dropped and rated it 6/10 (PS5)', { kind: 'dropped', rating: 6 }, 'PS5'],
    ['Dropped', { kind: 'dropped' }, null],
    ['Started playing (Switch)', { kind: 'playing' }, 'Switch'],
    ['Started playing', { kind: 'started' }, null],
    // A start that came from a pick ends by saying which.
    ['Started playing, picked at random (PS5)', { kind: 'started', pickedBy: 'random' }, 'PS5'],
    ['Started playing, picked at random', { kind: 'started', pickedBy: 'random' }, null],
    [
      'Started playing, picked by Pick My Game (Switch)',
      { kind: 'playing', pickedBy: 'questions' },
      'Switch',
    ],
    // A rating given by itself is the whole line: it isn't said again after it.
    ['Rated 7/10 (Switch 2)', { kind: 'rated', rating: 7 }, 'Switch 2'],
    ['Rated 7/10', { kind: 'rated', rating: 7 }, null],
    // A rating that replaced another.
    [
      'Changed rating from 6/10 to 8/10 (Switch)',
      { kind: 'rerated', rating: 8, from: 6 },
      'Switch',
    ],
    ['Played 2h 30m (Switch)', { kind: 'played', minutes: 150 }, 'Switch'],
    // Where it is now, the total to the hour.
    ['Played 2h 30m, 12h total (Switch)', { kind: 'played', minutes: 150, total: 745 }, 'Switch'],
    ['Played 20m, 50m total', { kind: 'played', minutes: 20, total: 50 }, null],
    ['Added to favorites', { kind: 'favorite' }, null],
    ['Added to backlog (PSP)', { kind: 'added' }, 'PSP'],
    // A move says where to, so its row names no platform after it.
    ['Moved to Switch', { kind: 'moved', to: 'Switch' }, null],
    ['Wrote a note', { kind: 'note' }, undefined],
  ])('reads "%s"', (sentence, line, platform) => {
    expect(said(line, platform)).toBe(sentence);
  });
});

it('colors and marks only what was done, with the rest reading on from it', () => {
  const { container } = render(
    <ActivityWhat line={{ kind: 'finished', rating: 9 }} platform="PC" />,
  );
  const done = container.querySelector('span > span')!;
  expect(done).toHaveTextContent(/^Finished$/);
  expect(done.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  // No second icon for the rating: it's part of the sentence.
  expect(container.querySelectorAll('svg')).toHaveLength(1);
});

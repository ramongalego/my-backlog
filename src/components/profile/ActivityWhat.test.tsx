import { render } from '@testing-library/react';
import { ActivityWhat } from '@/components/profile/ActivityWhat';
import type { ActivityLine } from '@/lib/account/activity';

const said = (line: ActivityLine) => {
  const { container } = render(<ActivityWhat line={line} />);
  return container.textContent;
};

describe('a finish, with whatever came with it', () => {
  it.each<[string, ActivityLine]>([
    ['Finished', { kind: 'finished' }],
    ['Finished and rated it 9/10', { kind: 'finished', rating: 9 }],
    // How long it took comes before the rating.
    ['Finished in 42h and rated it 9/10', { kind: 'finished', rating: 9, minutes: 2520 }],
    ['Finished in 1h 30m', { kind: 'finished', minutes: 90 }],
    ['Finished in 45m', { kind: 'finished', minutes: 45 }],
  ])('reads "%s"', (sentence, line) => {
    expect(said(line)).toBe(sentence);
  });
});

describe('everything else that can be done to a game', () => {
  it.each<[string, ActivityLine]>([
    ['Dropped and rated it 6/10', { kind: 'dropped', rating: 6 }],
    ['Dropped', { kind: 'dropped' }],
    ['Started playing', { kind: 'playing' }],
    ['Started playing', { kind: 'started' }],
    // A start that came from a pick ends by saying which.
    ['Started playing, picked at random', { kind: 'started', pickedBy: 'random' }],
    ['Started playing, picked by Pick My Game', { kind: 'playing', pickedBy: 'questions' }],
    // A rating given by itself is the whole line: it isn't said again after it.
    ['Rated 7/10', { kind: 'rated', rating: 7 }],
    // A rating that replaced another.
    ['Changed rating from 6/10 to 8/10', { kind: 'rerated', rating: 8, from: 6 }],
    ['Played 2h 30m', { kind: 'played', minutes: 150 }],
    // Where it is now, the total to the hour.
    ['Played 2h 30m, 12h total', { kind: 'played', minutes: 150, total: 745 }],
    ['Played 20m, 50m total', { kind: 'played', minutes: 20, total: 50 }],
    ['Added to favorites', { kind: 'favorite' }],
    ['Added to backlog', { kind: 'added' }],
    ['Moved to Switch', { kind: 'moved', to: 'Switch' }],
    ['Wrote a note', { kind: 'note' }],
  ])('reads "%s"', (sentence, line) => {
    expect(said(line)).toBe(sentence);
  });
});

it('colors and marks only what was done, with the rest reading on from it', () => {
  const { container } = render(<ActivityWhat line={{ kind: 'finished', rating: 9 }} />);
  const done = container.querySelector('span > span')!;
  expect(done).toHaveTextContent(/^Finished$/);
  expect(done.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  // No second icon for the rating: it's part of the sentence.
  expect(container.querySelectorAll('svg')).toHaveLength(1);
});

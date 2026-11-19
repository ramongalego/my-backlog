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
    ['Finished on PC', { kind: 'finished' }, 'PC'],
    ['Finished and rated it 9/10', { kind: 'finished', rating: 9 }, null],
    ['Finished on PC and rated it 9/10', { kind: 'finished', rating: 9 }, 'PC'],
  ])('reads "%s"', (sentence, line, platform) => {
    expect(said(line, platform)).toBe(sentence);
  });
});

describe('everything else that can be done to a game', () => {
  it.each<[string, ActivityLine, string | null | undefined]>([
    ['Dropped on PS5 and rated it 6/10', { kind: 'dropped', rating: 6 }, 'PS5'],
    ['Dropped', { kind: 'dropped' }, null],
    ['Started playing on Switch', { kind: 'playing' }, 'Switch'],
    ['Started playing', { kind: 'started' }, null],
    // A rating given by itself is the whole line: it isn't said again after it.
    ['Rated 7/10 on Switch 2', { kind: 'rated', rating: 7 }, 'Switch 2'],
    ['Rated 7/10', { kind: 'rated', rating: 7 }, null],
    ['Played 2h 30m on Switch', { kind: 'played', minutes: 150 }, 'Switch'],
    ['Added to favorites', { kind: 'favorite' }, null],
    ['Added to backlog on PSP', { kind: 'added' }, 'PSP'],
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

import { openGameLabel, selectGameLabel, withArtTags } from '@/lib/games/game-label';

const game = (overrides = {}) => ({
  name: 'Hades',
  status: 'backlog' as const,
  rating: null,
  ...overrides,
});

describe('openGameLabel', () => {
  it('is the game, with nothing else to show', () => {
    expect(openGameLabel(game())).toBe('Open details for Hades');
  });

  it('adds the status and rating badges as one phrase', () => {
    expect(openGameLabel(game({ status: 'finished', rating: 9 }))).toBe(
      'Open details for Hades, Finished 9/10',
    );
    expect(openGameLabel(game({ status: 'finished', rating: 9 }), { showStatus: false })).toBe(
      'Open details for Hades, 9/10',
    );
  });

  // The art draws the status or Queued badge, then the console, then the
  // release date. A name only matches what's on screen (WCAG 2.5.3) if its
  // words run in that order.
  it('adds the tags on the art after the badges, in the order they are drawn', () => {
    expect(openGameLabel(game({ status: 'finished', rating: 9 }), { console: 'PS5' })).toBe(
      'Open details for Hades, Finished 9/10, PS5',
    );
    expect(openGameLabel(game(), { queued: true, console: 'Switch 2', release: 'Out Nov 5' })).toBe(
      'Open details for Hades, Queued, Switch 2, Out Nov 5',
    );
  });
});

describe('withArtTags', () => {
  it('adds the console and the release date to any name, leaving out what is not there', () => {
    expect(withArtTags('Edit Hades', { console: 'PS5' })).toBe('Edit Hades, PS5');
    expect(withArtTags('Edit Hades', { console: null, release: 'Out Nov 5' })).toBe(
      'Edit Hades, Out Nov 5',
    );
    expect(withArtTags('Edit Hades', {})).toBe('Edit Hades');
  });
});

describe('selectGameLabel (Select mode)', () => {
  const can = { selectable: true };
  const cannot = { selectable: false };

  it('is just the game on a list row, whose button is only its name', () => {
    expect(selectGameLabel(game(), can)).toBe('Select Hades');
    expect(selectGameLabel(game(), cannot, true)).toBe(
      'Hades, queued: change it from its own dialog',
    );
  });

  it('has what is drawn on the art too, on a card', () => {
    expect(
      selectGameLabel(game({ status: 'finished', rating: 9 }), can, false, { console: 'PS5' }),
    ).toBe('Select Hades, Finished 9/10, PS5');
    expect(selectGameLabel(game(), cannot, true, { console: 'PS5', release: 'Out Nov 5' })).toBe(
      'Hades, queued, PS5, Out Nov 5: change it from its own dialog',
    );
    expect(selectGameLabel(game({ status: 'playing' }), cannot, false, {})).toBe(
      'Hades, playing: change it from its own dialog',
    );
  });
});

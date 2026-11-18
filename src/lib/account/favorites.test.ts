import {
  MAX_FAVORITES,
  favoriteChoices,
  pickedFavorites,
  sameFavorites,
  toggleFavorite,
} from '@/lib/account/favorites';
import { libraryGame as game } from './test-games';

describe('pickedFavorites', () => {
  const games = [
    game({ id: 1, name: 'Hades', status: 'finished', rating: 9 }),
    game({ id: 2, name: 'Celeste' }),
    game({ id: 3, name: 'Old Tool', status: 'hidden' }),
    game({ id: 4, name: 'Persona 5 Royal', status: 'dropped', rating: 6 }),
  ];

  it('gives the picked games in the order picked, as the library has them', () => {
    expect(pickedFavorites(games, [4, 1])).toEqual([
      { id: 4, name: 'Persona 5 Royal', header_image: 'https://example.com/art.jpg', rating: 6 },
      { id: 1, name: 'Hades', header_image: 'https://example.com/art.jpg', rating: 9 },
    ]);
  });

  it('leaves out a pick that was hidden since, or is no longer in the library', () => {
    expect(pickedFavorites(games, [3, 2, 99]).map((g) => g.id)).toEqual([2]);
  });

  it('shows a rating only on a finished or dropped game, as its card does', () => {
    // Back in the backlog with its old rating still on it.
    const replaying = game({ id: 5, status: 'backlog', rating: 8 });
    expect(pickedFavorites([replaying], [5])[0].rating).toBeNull();
  });

  it('is empty with nothing picked', () => {
    expect(pickedFavorites(games, [])).toEqual([]);
  });
});

describe('toggleFavorite', () => {
  it('adds a pick at the end, and takes one off', () => {
    expect(toggleFavorite([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleFavorite([1, 2, 3], 2)).toEqual([1, 3]);
  });

  it('adds nothing once all four places are taken, but still takes one off', () => {
    const full = [1, 2, 3, 4];
    expect(full).toHaveLength(MAX_FAVORITES);
    expect(toggleFavorite(full, 5)).toEqual(full);
    expect(toggleFavorite(full, 4)).toEqual([1, 2, 3]);
  });

  it('never changes the list it was given', () => {
    const picked = [1, 2];
    toggleFavorite(picked, 3);
    toggleFavorite(picked, 1);
    expect(picked).toEqual([1, 2]);
  });
});

describe('sameFavorites', () => {
  it('is the same games in the same order', () => {
    expect(sameFavorites([1, 2], [1, 2])).toBe(true);
    expect(sameFavorites([], [])).toBe(true);
    expect(sameFavorites([1, 2], [2, 1])).toBe(false);
    expect(sameFavorites([1, 2], [1])).toBe(false);
  });
});

describe('favoriteChoices', () => {
  const games = [
    game({ id: 1, name: 'Unrated', playtime_forever: 9000 }),
    game({ id: 2, name: 'Loved', status: 'finished', rating: 10, finished_at: '2026-01-01' }),
    game({ id: 3, name: 'Liked', status: 'finished', rating: 8, finished_at: '2026-02-01' }),
    game({ id: 4, name: 'Old Tool', status: 'hidden', rating: 10 }),
    game({ id: 5, name: 'Skipped', status: 'wont_play' }),
    game({ id: 6, name: 'Roguelike Thing', tags: ['Roguelike'] }),
    game({ id: 7, name: 'Rogue Legacy', status: 'finished', rating: 7, finished_at: '2026-03-01' }),
  ];

  it('offers everything but hidden games, the highest rated first', () => {
    const names = favoriteChoices(games, '').map((g) => g.name);
    expect(names.slice(0, 3)).toEqual(['Loved', 'Liked', 'Rogue Legacy']);
    expect(names).not.toContain('Old Tool');
    // Won't Play is still part of the library.
    expect(names).toContain('Skipped');
    expect(names).toHaveLength(6);
  });

  it('offers the whole library, however large', () => {
    const many = Array.from({ length: 500 }, (_, i) => game({ id: 100 + i, name: `Game ${i}` }));
    expect(favoriteChoices(many, '')).toHaveLength(500);
  });

  it('searches by name or tag, games named for the text first', () => {
    expect(favoriteChoices(games, ' rogue ').map((g) => g.name)).toEqual([
      'Rogue Legacy',
      'Roguelike Thing',
    ]);
    expect(favoriteChoices(games, 'nothing like this')).toEqual([]);
  });
});

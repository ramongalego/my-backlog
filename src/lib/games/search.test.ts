import { matchesSearch, nameMatchesSearch } from '@/lib/games/search';

describe('matchesSearch', () => {
  it('ignores accents and case, either way round', () => {
    expect(matchesSearch({ name: 'Pokémon Shield' }, 'pokemon')).toBe(true);
    expect(matchesSearch({ name: 'Pokémon Shield' }, 'POKÉMON')).toBe(true);
    expect(matchesSearch({ name: 'Ōkami HD' }, 'okami')).toBe(true);
    expect(matchesSearch({ name: 'Pokemon Shield (typed plain)' }, 'pokémon')).toBe(true);
  });

  it('matches tags too, and everything when there is nothing to match', () => {
    expect(matchesSearch({ name: 'Persona 3 Reload', tags: ['JRPG'] }, 'jrpg')).toBe(true);
    expect(matchesSearch({ name: 'Persona 3 Reload', tags: null }, 'metroid')).toBe(false);
    expect(matchesSearch({ name: 'Anything' }, '  ')).toBe(true);
  });
});

describe('nameMatchesSearch', () => {
  it('tells a name match from a tag-only match', () => {
    expect(nameMatchesSearch({ name: 'Metroid Dread' }, 'metroid')).toBe(true);
    expect(nameMatchesSearch({ name: 'Hollow Knight' }, 'metroid')).toBe(false);
    expect(nameMatchesSearch({ name: 'Ōkami HD' }, ' okami ')).toBe(true);
    expect(nameMatchesSearch({ name: 'Anything' }, '  ')).toBe(false);
  });
});

it('gives the same answers when the same library is searched again', () => {
  const games = [
    { name: 'Pokémon Platinum', tags: ['JRPG', 'Creature Collector'] },
    { name: 'Ōkami', tags: ['Action-Adventure'] },
    { name: 'Hades', tags: ['Roguelike'] },
  ];
  const find = (query: string) => games.filter((g) => matchesSearch(g, query)).map((g) => g.name);

  for (let pass = 0; pass < 2; pass++) {
    expect(find('pokemon')).toEqual(['Pokémon Platinum']);
    expect(find('okami')).toEqual(['Ōkami']);
    expect(find('rogue')).toEqual(['Hades']);
    expect(find('')).toHaveLength(3);
    expect(nameMatchesSearch(games[0], 'jrpg')).toBe(false);
  }
});

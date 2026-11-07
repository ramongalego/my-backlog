import { withoutLaterEntries } from '@/lib/games/series-order';

const g = (name: string, release_date: string | null = null) => ({ name, release_date });
const kept = (...games: ReturnType<typeof g>[]) => withoutLaterEntries(games).map((x) => x.name);

describe('withoutLaterEntries', () => {
  it('holds back a sequel while the game before it is in the backlog', () => {
    expect(
      kept(
        g('Hyperdimension Neptunia Re;Birth2 Sisters Generation'),
        g('Hyperdimension Neptunia Re;Birth1'),
      ),
    ).toEqual(['Hyperdimension Neptunia Re;Birth1']);
  });

  it('keeps only the earliest of several numbered entries', () => {
    expect(
      kept(
        g('The Legend of Heroes: Trails of Cold Steel IV'),
        g('The Legend of Heroes: Trails of Cold Steel II'),
        g('The Legend of Heroes: Trails of Cold Steel III'),
      ),
    ).toEqual(['The Legend of Heroes: Trails of Cold Steel II']);
  });

  it('treats an unnumbered first game as entry 1', () => {
    expect(kept(g('HITMAN 2'), g('HITMAN™'))).toEqual(['HITMAN™']);
    expect(kept(g('Yakuza 3 Remastered'), g('Yakuza 0'))).toEqual(['Yakuza 0']);
  });

  it('orders subtitled entries by release date', () => {
    expect(
      kept(
        g('Castlevania: Lords of Shadow – Mirror of Fate HD', 'Mar 6, 2014'),
        g('Castlevania: Lords of Shadow – Ultimate Edition', 'Aug 27, 2013'),
      ),
    ).toEqual(['Castlevania: Lords of Shadow – Ultimate Edition']);
  });

  it('never holds back series whose entries stand alone', () => {
    const games = [
      g('FINAL FANTASY X/X-2 HD Remaster'),
      g('FINAL FANTASY VII'),
      g('DRAGON QUEST XI S: Echoes of an Elusive Age – Definitive Edition'),
      g('DRAGON QUEST VIII'),
      g('The Witcher 3: Wild Hunt'),
      g('The Witcher: Enhanced Edition'),
      g('The Sims 4'),
      g('The Sims 3'),
    ];
    expect(kept(...games)).toEqual(games.map((x) => x.name));
  });

  it('leaves unrelated games that only share a word alone', () => {
    expect(kept(g('Portal 2'), g('Portal Knights'))).toEqual(['Portal 2', 'Portal Knights']);
    expect(kept(g('Metro Exodus'), g('Metro 2033 Redux'))).toEqual([
      'Metro Exodus',
      'Metro 2033 Redux',
    ]);
  });

  it('does not count another edition of the same game as an earlier entry', () => {
    expect(kept(g('Dark Souls III'), g('DARK SOULS III: Deluxe Edition'))).toHaveLength(2);
  });
});

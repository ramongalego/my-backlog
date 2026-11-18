import {
  consoleOf,
  knownConsole,
  libraryPlatforms,
  platformOf,
  platformTag,
  platformToSay,
} from '@/lib/games/consoles';

describe('platformOf (what the platform filter lists a game under)', () => {
  it('is PC for a game played on Steam, saved that way or not', () => {
    expect(platformOf({ source: 'steam', platform: 'PC' })).toBe('PC');
    expect(platformOf({ source: 'steam', platform: null })).toBe('PC');
  });

  it('is the console a Steam game was moved to', () => {
    expect(platformOf({ source: 'steam', platform: 'Switch' })).toBe('Switch');
  });

  it("is a hand-added game's console, PC included (another store)", () => {
    expect(platformOf({ source: 'manual', platform: 'PS5' })).toBe('PS5');
    expect(platformOf({ source: 'manual', platform: 'PC' })).toBe('PC');
  });

  it('is nothing for a hand-added game with no console saved', () => {
    expect(platformOf({ source: 'manual', platform: null })).toBeNull();
    expect(platformOf({ source: 'manual', platform: '' })).toBeNull();
  });

  it('names PC where the tag on the art stays quiet about it', () => {
    const onSteam = { source: 'steam', platform: 'PC' };
    expect(consoleOf(onSteam)).toBeNull();
    expect(platformOf(onSteam)).toBe('PC');
  });
});

describe('knownConsole (a console typed by hand, as the app already calls it)', () => {
  it.each([
    ['Switch 2', 'Switch 2'],
    ['switch 2', 'Switch 2'],
    ['SWITCH2', 'Switch 2'],
    ['Nintendo Switch 2', 'Switch 2'],
    ['nintendo switch', 'Switch'],
    ['ps 5', 'PS5'],
    ['PlayStation 5', 'PS5'],
    ['xbox series x/s', 'Xbox Series X|S'],
    ['pc', 'PC'],
    ['game boy advance', 'GBA'],
  ])('takes "%s" for %s', (typed, saved) => {
    expect(knownConsole(typed)).toBe(saved);
  });

  it("doesn't take one console for another that only starts the same", () => {
    expect(knownConsole('Switch 3')).toBeNull();
    expect(knownConsole('Nintendo')).toBeNull();
    expect(knownConsole('Family Computer Disk System')).toBe('Famicom Disk System');
    expect(knownConsole('Family Computer')).toBe('Famicom');
  });

  it('takes one of the given names, spelled another way', () => {
    expect(knownConsole('commodore 64', ['Commodore 64'])).toBe('Commodore 64');
    expect(knownConsole('Xbox One', ['Xbox One', 'PC'])).toBe('Xbox One');
  });

  it("prefers the app's own name to one given", () => {
    expect(knownConsole('nintendo switch 2', ['Nintendo Switch 2'])).toBe('Switch 2');
  });

  it("is nothing for a console it doesn't know, or nothing typed", () => {
    expect(knownConsole('Commodore 64')).toBeNull();
    expect(knownConsole('Commodore 64', ['Amiga'])).toBeNull();
    expect(knownConsole('   ')).toBeNull();
    expect(knownConsole('!!')).toBeNull();
  });
});

describe('libraryPlatforms (what the library is played on)', () => {
  const of = (entries: [string, number][]) => libraryPlatforms(new Map(entries));

  it('is the platform most of the library is on, and how many there are', () => {
    expect(
      of([
        ['PC', 151],
        ['Switch 2', 19],
        ['DS', 12],
      ]),
    ).toEqual({ main: 'PC', count: 3 });
    expect(
      of([
        ['PC', 4],
        ['PS5', 30],
      ]),
    ).toEqual({ main: 'PS5', count: 2 });
  });

  it("doesn't count a platform with no games", () => {
    expect(
      of([
        ['PC', 0],
        ['Switch', 3],
      ]),
    ).toEqual({ main: 'Switch', count: 1 });
  });

  it('settles a tie the same way every time: PC, then the first name', () => {
    expect(
      of([
        ['Switch', 5],
        ['PC', 5],
      ]),
    ).toEqual({ main: 'PC', count: 2 });
    expect(
      of([
        ['Switch', 5],
        ['DS', 5],
      ]),
    ).toEqual({ main: 'DS', count: 2 });
    expect(
      of([
        ['DS', 5],
        ['Switch', 5],
      ]),
    ).toEqual({ main: 'DS', count: 2 });
  });

  it('is nothing for an empty library', () => {
    expect(of([])).toEqual({ main: null, count: 0 });
    expect(of([['PC', 0]])).toEqual({ main: null, count: 0 });
  });
});

describe('platformToSay and platformTag (where a game is played, in text and on art)', () => {
  const steam = { source: 'steam', platform: 'PC' };
  const switch2 = { source: 'manual', platform: 'Switch 2' };
  const ps5 = { source: 'manual', platform: 'PS5' };
  const mostlyPc = { main: 'PC', count: 3 };
  const mostlyPs5 = { main: 'PS5', count: 2 };
  const onlyPc = { main: 'PC', count: 1 };

  it('says every game where it is played in text, PC included, in a library on several platforms', () => {
    expect(platformToSay(steam, mostlyPc)).toBe('PC');
    expect(platformToSay(switch2, mostlyPc)).toBe('Switch 2');
    expect(platformToSay(steam, mostlyPs5)).toBe('PC');
  });

  it('says nothing in text for a library all on one platform', () => {
    expect(platformToSay(steam, onlyPc)).toBeNull();
  });

  it('tags on art only what is not where most of the library is', () => {
    expect(platformTag(steam, mostlyPc)).toBeNull();
    expect(platformTag(switch2, mostlyPc)).toBe('Switch 2');
    expect(platformTag(steam, mostlyPs5)).toBe('PC');
    expect(platformTag(ps5, mostlyPs5)).toBeNull();
    expect(platformTag(steam, onlyPc)).toBeNull();
  });

  it('says only consoles, as before, until the library is known', () => {
    for (const library of [null, undefined]) {
      expect(platformToSay(steam, library)).toBeNull();
      expect(platformTag(steam, library)).toBeNull();
      expect(platformToSay(switch2, library)).toBe('Switch 2');
      expect(platformTag(switch2, library)).toBe('Switch 2');
    }
  });

  it('says nothing for a game on no platform', () => {
    const none = { source: 'manual', platform: null };
    expect(platformToSay(none, mostlyPc)).toBeNull();
    expect(platformTag(none, mostlyPc)).toBeNull();
  });
});

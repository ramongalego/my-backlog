import { consoleOf, knownConsole, platformOf } from '@/lib/games/consoles';

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

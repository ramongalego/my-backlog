import { consoleOf, platformOf } from '@/lib/games/consoles';

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

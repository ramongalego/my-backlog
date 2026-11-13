import { chooseArt, originalArt, syncedArt } from '@/lib/games/art';

const STEAM = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/header.jpg';
const PICK = 'https://cdn2.steamgriddb.com/grid/abc.png';
const OTHER_PICK = 'https://cdn2.steamgriddb.com/grid/def.png';

const untouched = { header_image: STEAM, art_chosen: false, default_header_image: null };
const chosen = { header_image: PICK, art_chosen: true, default_header_image: STEAM };

describe('chooseArt', () => {
  it('shows the pick and keeps the art it replaces as the default', () => {
    expect(chooseArt(untouched, PICK)).toEqual(chosen);
  });

  it('keeps the first default when another image is picked later', () => {
    expect(chooseArt(chosen, OTHER_PICK)).toEqual({
      header_image: OTHER_PICK,
      art_chosen: true,
      default_header_image: STEAM,
    });
  });

  it('goes back to the original', () => {
    expect(chooseArt(chosen, null)).toEqual(untouched);
  });

  it('treats picking the original itself as going back to it', () => {
    expect(chooseArt(chosen, STEAM)).toEqual(untouched);
    // A console game's original is often SteamGridDB's art already.
    const console = { header_image: PICK, art_chosen: false, default_header_image: null };
    expect(chooseArt(console, PICK)).toEqual(console);
  });

  it('can choose art for a game that had none, and go back to none', () => {
    const none = { header_image: null, art_chosen: false, default_header_image: null };
    const picked = chooseArt(none, PICK);
    expect(picked).toEqual({ header_image: PICK, art_chosen: true, default_header_image: null });
    expect(chooseArt(picked!, null)).toEqual(none);
  });

  it.each([
    ['another site', 'https://example.com/a.png'],
    ['a look-alike host', 'https://cdn2.steamgriddb.com.example.com/a.png'],
    ['plain http', 'http://cdn2.steamgriddb.com/grid/abc.png'],
    ['not a URL', 'javascript:alert(1)'],
  ])("refuses an image that isn't SteamGridDB's: %s", (_, url) => {
    expect(chooseArt(untouched, url)).toBeNull();
  });
});

describe('originalArt', () => {
  it("is what the game shows until it's chosen, then the default behind the choice", () => {
    expect(originalArt(untouched)).toBe(STEAM);
    expect(originalArt(chosen)).toBe(STEAM);
  });
});

describe('syncedArt', () => {
  it('writes fresh art to the column shown, or behind a choice', () => {
    expect(syncedArt({ art_chosen: false }, STEAM)).toEqual({ header_image: STEAM });
    expect(syncedArt({ art_chosen: true }, STEAM)).toEqual({ default_header_image: STEAM });
  });
});

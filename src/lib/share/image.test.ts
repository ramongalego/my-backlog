import { safeShareImage } from '@/lib/share/image';

describe('safeShareImage', () => {
  it.each([
    ['Steam', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/header.jpg'],
    ["Steam's older CDN", 'https://steamcdn-a.akamaihd.net/steam/apps/10/header.jpg'],
    ['IGDB', 'https://images.igdb.com/igdb/image/upload/t_1080p/abc.jpg'],
    // Console games neither Steam nor IGDB has wide art for.
    ['SteamGridDB', 'https://cdn2.steamgriddb.com/grid/abc.png'],
  ])('keeps art from %s', (_, url) => {
    expect(safeShareImage(url)).toBe(url);
  });

  it.each([
    ['another host', 'https://example.com/a.jpg'],
    ['a lookalike host', 'https://steamstatic.com.evil.test/a.jpg'],
    ['plain http', 'http://images.igdb.com/a.jpg'],
    ['an internal address', 'https://169.254.169.254/latest/meta-data'],
    ['not a URL', 'header.jpg'],
    ['nothing', null],
  ])('drops %s', (_, url) => {
    expect(safeShareImage(url)).toBeNull();
  });
});

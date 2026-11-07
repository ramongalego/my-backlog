import { extractSteamId, isSteamAssertion } from '@/lib/steam/auth';
import { extractGameMetadata, SteamGameDetails } from '@/lib/steam/store-api';

describe('extractSteamId', () => {
  it('should extract Steam ID from valid OpenID URL', () => {
    const url = 'https://steamcommunity.com/openid/id/76561198012345678';
    expect(extractSteamId(url)).toBe('76561198012345678');
  });

  it('should reject IDs that are not 64-bit SteamIDs', () => {
    expect(extractSteamId('https://steamcommunity.com/openid/id/123456789')).toBeNull();
  });

  it('should reject a Steam URL embedded in another identity', () => {
    expect(
      extractSteamId('https://evil.example/https://steamcommunity.com/openid/id/76561198012345678'),
    ).toBeNull();
    expect(
      extractSteamId('https://steamcommunity.com/openid/id/76561198012345678/extra'),
    ).toBeNull();
  });

  it('should return null for invalid URL format', () => {
    expect(extractSteamId('https://example.com/id/12345')).toBeNull();
    expect(extractSteamId('steamcommunity.com/openid/id/12345')).toBeNull();
    expect(extractSteamId('')).toBeNull();
  });

  it('should return null for URL with non-numeric ID', () => {
    expect(extractSteamId('https://steamcommunity.com/openid/id/abc')).toBeNull();
  });

  it('should return null for partial matches', () => {
    expect(extractSteamId('https://steamcommunity.com/openid/')).toBeNull();
    expect(extractSteamId('https://steamcommunity.com/openid/id/')).toBeNull();
  });
});

describe('isSteamAssertion', () => {
  const steamId = 'https://steamcommunity.com/openid/id/76561198012345678';
  const params = (overrides: Record<string, string> = {}) =>
    new URLSearchParams({
      'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
      'openid.claimed_id': steamId,
      'openid.identity': steamId,
      ...overrides,
    });

  it('should accept an assertion issued by Steam', () => {
    expect(isSteamAssertion(params())).toBe(true);
  });

  it('should reject an assertion from another provider', () => {
    expect(isSteamAssertion(params({ 'openid.op_endpoint': 'https://evil.example/login' }))).toBe(
      false,
    );
  });

  it('should reject a spoofed claimed_id', () => {
    const spoofed = `https://evil.example/${steamId}`;
    expect(
      isSteamAssertion(params({ 'openid.claimed_id': spoofed, 'openid.identity': spoofed })),
    ).toBe(false);
  });

  it('should reject a mismatched identity', () => {
    expect(isSteamAssertion(params({ 'openid.identity': 'https://evil.example/' }))).toBe(false);
  });
});

describe('extractGameMetadata', () => {
  it('should extract all metadata from complete response', () => {
    const details: SteamGameDetails = {
      success: true,
      data: {
        type: 'game',
        name: 'Test Game',
        steam_appid: 12345,
        short_description: 'A test game description',
        header_image: 'https://cdn.steam.com/image.jpg',
        genres: [
          { id: '1', description: 'Action' },
          { id: '2', description: 'Adventure' },
        ],
        categories: [
          { id: 1, description: 'Single-player' },
          { id: 2, description: 'Multi-player' },
        ],
        release_date: { coming_soon: false, date: 'Jan 1, 2020' },
      },
    };

    const result = extractGameMetadata(details);

    expect(result).toEqual({
      type: 'game',
      genres: ['Action', 'Adventure'],
      categories: ['Single-player', 'Multi-player'],
      description: 'A test game description',
      release_date: 'Jan 1, 2020',
      header_image: 'https://cdn.steam.com/image.jpg',
    });
  });

  it('should return null when success is false', () => {
    const details: SteamGameDetails = {
      success: false,
    };

    expect(extractGameMetadata(details)).toBeNull();
  });

  it('should return null when data is missing', () => {
    const details: SteamGameDetails = {
      success: true,
    };

    expect(extractGameMetadata(details)).toBeNull();
  });

  it('should handle missing optional fields', () => {
    const details: SteamGameDetails = {
      success: true,
      data: {
        type: 'game',
        name: 'Minimal Game',
        steam_appid: 99999,
        short_description: '',
        header_image: '',
      },
    };

    const result = extractGameMetadata(details);

    expect(result).toEqual({
      type: 'game',
      genres: [],
      categories: [],
      description: null,
      release_date: null,
      header_image: null,
    });
  });

  it('should handle empty genres and categories arrays', () => {
    const details: SteamGameDetails = {
      success: true,
      data: {
        type: 'game',
        name: 'No Genre Game',
        steam_appid: 11111,
        short_description: 'Description here',
        header_image: 'https://image.url',
        genres: [],
        categories: [],
      },
    };

    const result = extractGameMetadata(details);

    expect(result?.genres).toEqual([]);
    expect(result?.categories).toEqual([]);
  });

  it('should extract type for DLC and software', () => {
    const dlcDetails: SteamGameDetails = {
      success: true,
      data: {
        type: 'dlc',
        name: 'Some DLC',
        steam_appid: 22222,
        short_description: 'DLC content',
        header_image: 'https://image.url',
      },
    };

    const softwareDetails: SteamGameDetails = {
      success: true,
      data: {
        type: 'software',
        name: 'Wallpaper Engine',
        steam_appid: 33333,
        short_description: 'Software app',
        header_image: 'https://image.url',
      },
    };

    expect(extractGameMetadata(dlcDetails)?.type).toBe('dlc');
    expect(extractGameMetadata(softwareDetails)?.type).toBe('software');
  });
});

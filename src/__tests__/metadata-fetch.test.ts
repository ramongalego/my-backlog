import { fetchGameMetadata } from '@/lib/games/metadata-fetch';
import * as store from '@/lib/steam/store-api';
import { getMainStoryHours, HLTBUnavailableError } from '@/lib/hltb/api';

jest.mock('@/lib/steam/store-api', () => ({
  ...jest.requireActual('@/lib/steam/store-api'),
  getGameDetails: jest.fn(),
  getStoreItemInfo: jest.fn(),
  getSteamDeckCompat: jest.fn(),
}));
jest.mock('@/lib/hltb/api', () => ({
  ...jest.requireActual('@/lib/hltb/api'),
  getMainStoryHours: jest.fn(),
}));

const details = (type: string) => ({
  success: true,
  data: {
    type,
    name: 'Steam Name',
    steam_appid: 1,
    short_description: '',
    header_image: 'https://cdn/header.jpg',
    genres: [{ id: '1', description: 'Action' }],
  },
});

beforeEach(() => {
  jest.mocked(store.getStoreItemInfo).mockResolvedValue({
    tags: ['Action'],
    headerImage2x: null,
    headerImage: null,
    reviews: { score: 90, count: 1000 },
  });
  jest.mocked(store.getSteamDeckCompat).mockResolvedValue(3);
  jest.mocked(getMainStoryHours).mockResolvedValue(12);
});

it('starts every lookup without waiting for the Steam details', async () => {
  let resolveDetails!: (v: store.SteamGameDetails) => void;
  jest
    .mocked(store.getGameDetails)
    .mockReturnValue(new Promise((resolve) => (resolveDetails = resolve)));

  const pending = fetchGameMetadata(1, 'Library Name');
  await Promise.resolve();

  expect(getMainStoryHours).toHaveBeenCalledWith('Library Name');
  expect(store.getStoreItemInfo).toHaveBeenCalledWith(1);
  expect(store.getSteamDeckCompat).toHaveBeenCalledWith(1);

  resolveDetails(details('game'));
  const metadata = await pending;
  expect(metadata).toMatchObject({ type: 'game', main_story_hours: 12, deck_compat: 3 });
});

it('drops the extra lookups for things that are not games', async () => {
  jest.mocked(store.getGameDetails).mockResolvedValue(details('dlc'));
  const metadata = await fetchGameMetadata(1, 'Library Name');
  expect(metadata).toMatchObject({ type: 'dlc', main_story_hours: null, tags: null });
});

it('lets "Steam is busy" through so the game is retried', async () => {
  jest
    .mocked(store.getGameDetails)
    .mockRejectedValue(new store.SteamUnavailableError(1, 'HTTP 429'));
  await expect(fetchGameMetadata(1, 'Library Name')).rejects.toBeInstanceOf(
    store.SteamUnavailableError,
  );
});

it('marks the time as pending when HLTB is rate limiting', async () => {
  jest.mocked(store.getGameDetails).mockResolvedValue(details('game'));
  jest.mocked(getMainStoryHours).mockRejectedValue(new HLTBUnavailableError());
  const metadata = await fetchGameMetadata(1, 'Library Name');
  expect(metadata).toMatchObject({ main_story_hours: null, hltbUnavailable: true, deck_compat: 3 });
});

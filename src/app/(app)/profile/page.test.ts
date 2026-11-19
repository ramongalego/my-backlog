/**
 * @jest-environment node
 */
import ProfilePage from './page';
import { ownUsername } from '@/lib/server/own-username';

jest.mock('@/lib/server/own-username', () => ({ ownUsername: jest.fn() }));
const mockRedirect = jest.fn((to: string) => {
  throw new Error(`REDIRECT ${to}`);
});
jest.mock('next/navigation', () => ({ redirect: (to: string) => mockRedirect(to) }));

beforeEach(() => jest.clearAllMocks());

it("sends the player to their profile's own address", async () => {
  jest.mocked(ownUsername).mockResolvedValue('mistkai');
  await expect(ProfilePage()).rejects.toThrow('REDIRECT /u/mistkai');
});

it('goes Home when the profile cannot be read, rather than to an address of nobody', async () => {
  jest.mocked(ownUsername).mockResolvedValue(null);
  await expect(ProfilePage()).rejects.toThrow('REDIRECT /home');
});

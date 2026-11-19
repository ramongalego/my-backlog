/**
 * @jest-environment node
 */
import ProfileLayout from './layout';
import { ownUsername } from '@/lib/server/own-username';
import { publicProfileExists } from '@/lib/server/public-profile';

jest.mock('@/lib/server/own-username', () => ({ ownUsername: jest.fn() }));
jest.mock('@/lib/server/public-profile', () => ({ publicProfileExists: jest.fn() }));
const mockNotFound = jest.fn(() => {
  throw new Error('NOT_FOUND');
});
jest.mock('next/navigation', () => ({ notFound: () => mockNotFound() }));

const page = <p>the page</p>;
const at = (username: string) =>
  ProfileLayout({ children: page, params: Promise.resolve({ username }) });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(ownUsername).mockResolvedValue(null);
  jest.mocked(publicProfileExists).mockResolvedValue(true);
});

it('lets the page through for a profile there is to show', async () => {
  expect(await at('mistkai')).toBe(page);
  expect(publicProfileExists).toHaveBeenCalledWith('mistkai');
});

it('is a missing page, before the page starts, for an address with no profile to show', async () => {
  // Nobody has it, or its player made it private: the same answer.
  jest.mocked(publicProfileExists).mockResolvedValue(false);
  await expect(at('nobody')).rejects.toThrow('NOT_FOUND');

  jest.mocked(ownUsername).mockResolvedValue('someoneelse');
  await expect(at('mistkai')).rejects.toThrow('NOT_FOUND');
});

it("lets the player through to their own, private or not, without asking if it's shown", async () => {
  jest.mocked(ownUsername).mockResolvedValue('mistkai');
  jest.mocked(publicProfileExists).mockResolvedValue(false);
  expect(await at('mistkai')).toBe(page);
  // However they typed it: the page sends that on to the real address.
  expect(await at('MistKai')).toBe(page);
  expect(publicProfileExists).not.toHaveBeenCalled();
});

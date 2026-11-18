import { render, screen } from '@testing-library/react';
import UsagePage from '@/app/usage/page';
import { loadUsage } from '@/lib/server/usage';
import type { Usage } from '@/lib/usage';

const NOT_FOUND = new Error('NEXT_NOT_FOUND');
jest.mock('next/navigation', () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));

let signedIn: { id: string } | null = null;
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn }, error: null }) },
  }),
}));

jest.mock('@/lib/server/usage', () => ({ loadUsage: jest.fn() }));

const OWNER = '28f2ff71-1111-4222-8333-444455556666';

const usage: Usage = {
  players: 12,
  steamConnected: 9,
  withGames: 10,
  activeDay: 2,
  activeWeek: 5,
  activeMonth: 8,
  cameBack: 6,
  signups: { email: 8, google: 3, discord: 1, unconfirmed: 2 },
  libraries: { medianGames: 140, steamGames: 1500, manualGames: 40, manualOnly: 1 },
  features: {
    queue: 6,
    favorites: 4,
    notes: 2,
    ratings: 7,
    addedByHand: 3,
    chosenArt: 1,
    shareCards: 2,
    nameOrPicture: 5,
    profile: 4,
    roast: 3,
  },
  pickMyGame: {
    questions: 14,
    random: 6,
    played: 5,
    queued: 6,
    rerolled: 4,
    closed: 5,
    moods: [
      { answer: 'relaxed', picks: 8 },
      { answer: 'engaged', picks: 4 },
    ],
    energies: [],
    times: [{ answer: 'short', picks: 9 }],
  },
  weeks: [{ start: '2026-11-16T00:00:00+00:00', signups: 3, active: 5, picks: 7, finishes: 1 }],
  month: {
    picks: 20,
    picksTaken: 11,
    pickers: 4,
    finishes: 3,
    finishers: 2,
    insightWriters: 5,
    supportTickets: 1,
  },
};

beforeEach(() => {
  process.env.OWNER_USER_IDS = OWNER;
  jest.mocked(loadUsage).mockReset().mockResolvedValue(usage);
});
afterEach(() => {
  delete process.env.OWNER_USER_IDS;
});

it.each([
  ['signed out', null],
  ['signed in as someone else', { id: '9a0b1c2d-1111-4222-8333-444455556666' }],
])('is not found, and counts nothing, for anyone %s', async (_, user) => {
  signedIn = user;
  await expect(UsagePage()).rejects.toBe(NOT_FOUND);
  expect(loadUsage).not.toHaveBeenCalled();
});

it('is not found for the owner either when no owner is set', async () => {
  delete process.env.OWNER_USER_IDS;
  signedIn = { id: OWNER };
  await expect(UsagePage()).rejects.toBe(NOT_FOUND);
  expect(loadUsage).not.toHaveBeenCalled();
});

it('shows the owner the counts', async () => {
  signedIn = { id: OWNER };
  render(await UsagePage());
  expect(screen.getByRole('heading', { name: 'Usage', level: 1 })).toBeInTheDocument();
  expect(screen.getByText('Connected Steam')).toHaveTextContent('Connected Steam 75%');
  expect(screen.getByRole('row', { name: 'This week 3 5 7 1' })).toBeInTheDocument();
  expect(screen.getByText('Never confirmed their email')).toHaveTextContent('17%');
});

it('names the answers as the picker shows them', async () => {
  signedIn = { id: OWNER };
  render(await UsagePage());
  expect(screen.getByText('Relaxed 8, Engaged 4')).toBeInTheDocument();
  expect(screen.getByText('No answers yet')).toBeInTheDocument();
});

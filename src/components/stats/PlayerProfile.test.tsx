import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlayerProfile } from '@/components/stats/PlayerProfile';
import { fetchInsight } from '@/lib/client/insights';
import { loadSavedInsights } from '@/lib/data/loaders';
import type { SavedInsight, SavedInsights } from '@/lib/profile/saved';

jest.mock('@/lib/client/insights', () => ({ fetchInsight: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/data/loaders', () => ({
  ...jest.requireActual('@/lib/data/loaders'),
  loadSavedInsights: jest.fn(),
}));
const fetchMock = fetchInsight as jest.MockedFunction<typeof fetchInsight>;
const loadMock = loadSavedInsights as jest.MockedFunction<typeof loadSavedInsights>;

const NOW = 'sig-now';

const insight = (headline: string, signature = NOW): SavedInsight => ({
  headline,
  paragraphs: [`About you: ${headline}.`],
  signature,
  generatedAt: new Date(new Date().getFullYear(), 10, 7, 12).toISOString(),
});

let saved: SavedInsights;

const show = (client = new QueryClient()) =>
  render(
    <QueryClientProvider client={client}>
      <PlayerProfile userId="user-1" signature={NOW} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  saved = { profile: null, roast: null };
  loadMock.mockReset().mockImplementation(async () => saved);
  fetchMock
    .mockReset()
    .mockImplementation(async (tone) => insight(tone === 'roast' ? 'The roast' : 'The profile'));
});

it('shows the saved profile as Stats loads, with the day it was written, writing nothing', async () => {
  saved.profile = insight('Saved profile');
  show();
  expect(await screen.findByRole('heading', { name: 'Saved profile' })).toBeInTheDocument();
  expect(screen.getByText('Written November 7')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Rewrite' })).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('writes nothing until the player asks, then moves focus to what was written', async () => {
  show();
  const ask = await screen.findByRole('button', { name: 'Read my profile' });
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.click(ask);
  const heading = await screen.findByRole('heading', { name: 'The profile' });
  expect(fetchMock).toHaveBeenCalledWith('profile');
  expect(heading).toHaveFocus();
});

it('keeps one written earlier: coming back shows it without asking again', async () => {
  const client = new QueryClient();
  const first = show(client);
  fireEvent.click(await screen.findByRole('button', { name: 'Read my profile' }));
  await screen.findByRole('heading', { name: 'The profile' });
  first.unmount();

  show(client);
  expect(screen.getByRole('heading', { name: 'The profile' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('keeps the profile and the roast apart', async () => {
  saved.profile = insight('Saved profile');
  show();
  await screen.findByRole('heading', { name: 'Saved profile' });

  fireEvent.click(screen.getByRole('button', { name: 'Roast' }));
  fireEvent.click(screen.getByRole('button', { name: 'Roast me' }));
  expect(await screen.findByRole('heading', { name: 'The roast' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
  expect(screen.getByRole('heading', { name: 'Saved profile' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('says when the library has changed since, and rewrites it only when asked', async () => {
  saved.profile = insight('Old profile', 'sig-before');
  show();
  expect(await screen.findByRole('heading', { name: 'Old profile' })).toBeInTheDocument();
  expect(
    screen.getByText('Written November 7. Your library has changed since.'),
  ).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Rewrite' }));
  const heading = await screen.findByRole('heading', { name: 'The profile' });
  expect(heading).toHaveFocus();
  expect(screen.queryByRole('button', { name: 'Rewrite' })).not.toBeInTheDocument();
  expect(screen.getByText('Written November 7')).toBeInTheDocument();
});

it('says so when a rewrite comes back as the old one', async () => {
  saved.profile = insight('Old profile', 'sig-before');
  fetchMock.mockResolvedValueOnce(insight('Old profile', 'sig-before'));
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Rewrite' }));
  expect(
    await screen.findByText('Couldn’t write a new one right now. Try again later.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Rewrite' })).toBeInTheDocument();
});

it('says what went wrong and offers to try again', async () => {
  fetchMock.mockRejectedValueOnce(new Error('Try again tomorrow'));
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Read my profile' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again tomorrow');

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'The profile' })).toBeInTheDocument();
});

it('asks once when the button is pressed several times', async () => {
  show();
  const ask = await screen.findByRole('button', { name: 'Read my profile' });
  act(() => {
    fireEvent.click(ask);
    fireEvent.click(ask);
    fireEvent.click(ask);
  });
  await screen.findByRole('heading', { name: 'The profile' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

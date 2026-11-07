import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlayerProfile } from '@/components/stats/PlayerProfile';
import { fetchInsight } from '@/lib/client/insights';

jest.mock('@/lib/client/insights', () => ({ fetchInsight: jest.fn() }));
const fetchMock = fetchInsight as jest.MockedFunction<typeof fetchInsight>;

const show = (client = new QueryClient()) =>
  render(
    <QueryClientProvider client={client}>
      <PlayerProfile userId="user-1" />
    </QueryClientProvider>,
  );

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async (tone) => ({
    headline: tone === 'roast' ? 'The roast' : 'The profile',
    paragraphs: [`About you, ${tone}.`],
    generatedAt: '2026-11-07T00:00:00.000Z',
  }));
});

it('writes nothing until the player asks for it', async () => {
  show();
  expect(screen.getByRole('button', { name: 'Read my profile' })).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Read my profile' }));
  expect(await screen.findByRole('heading', { name: 'The profile' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('profile');
});

it('asks again for the roast, on its own button', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Read my profile' }));
  await screen.findByRole('heading', { name: 'The profile' });

  fireEvent.click(screen.getByRole('button', { name: 'Roast' }));
  expect(screen.queryByRole('heading', { name: 'The profile' })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: 'Roast me' }));
  expect(await screen.findByRole('heading', { name: 'The roast' })).toBeInTheDocument();

  // The profile was already written: switching back shows it without asking again.
  fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
  expect(screen.getByRole('heading', { name: 'The profile' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('shows one asked for earlier in the visit straight away', async () => {
  const client = new QueryClient();
  const first = show(client);
  fireEvent.click(screen.getByRole('button', { name: 'Read my profile' }));
  await screen.findByRole('heading', { name: 'The profile' });
  first.unmount();

  show(client);
  expect(screen.getByRole('heading', { name: 'The profile' })).toBeInTheDocument();
});

it('says what went wrong and offers to try again', async () => {
  fetchMock.mockRejectedValueOnce(new Error('Try again tomorrow'));
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Read my profile' }));
  expect(await screen.findByText('Try again tomorrow')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'The profile' })).toBeInTheDocument();
});

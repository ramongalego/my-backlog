import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuggestionModal } from '@/components/suggest/SuggestionModal';
import { findRandomBacklogGame } from '@/lib/client/random-pick';
import { recordPickOutcome, recordRandomPick } from '@/lib/client/picks';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u' } }) }));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/client/random-pick', () => ({
  ...jest.requireActual('@/lib/client/random-pick'),
  findRandomBacklogGame: jest.fn(),
}));

jest.mock('@/lib/client/picks', () => ({
  recordRandomPick: jest.fn(),
  recordPickOutcome: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const celeste = {
  id: 4,
  app_id: 504230,
  source: 'steam',
  platform: 'PC',
  name: 'Celeste',
  header_image: null,
  main_story_hours: 8,
  genres: ['Platformer'],
  tags: ['Precision Platformer'],
  steam_review_score: 97,
  steam_review_count: 1000,
  critic_score: 91,
  critic_count: 10,
  playtime_forever: 0,
  last_played_at: null,
};

function setup(mode: 'play' | 'queue', randomOnly = false) {
  const onPick = jest.fn();
  const onPlayNow = jest.fn();
  const onClose = jest.fn();
  const { unmount } = render(
    <QueryClientProvider client={new QueryClient()}>
      <SuggestionModal
        isOpen
        onClose={onClose}
        onPick={onPick}
        onPlayNow={onPlayNow}
        mode={mode}
        randomOnly={randomOnly}
      />
    </QueryClientProvider>,
  );
  return { onPick, onPlayNow, onClose, unmount };
}

// The ids the server keeps random picks under, in the order they're made.
let nextPickId: number;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(findRandomBacklogGame).mockResolvedValue({ game: celeste });
  nextPickId = 41;
  jest.mocked(recordRandomPick).mockImplementation(async () => nextPickId++);
  // Pick My Game's own answer: Celeste, kept as pick 90.
  mockFetch.mockReset().mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url === '/api/suggest'
        ? { success: true, data: { game: celeste, reasoning: 'Short and sharp.', pickId: 90 } }
        : { success: true },
  }));
});

const leaveToChance = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Leave it to chance/ }));
  });
/** Answers the three questions, with the first answer each time. */
async function answerQuestions() {
  for (let question = 0; question < 3; question++) {
    await act(async () => {
      fireEvent.click(within(screen.getByRole('group')).getAllByRole('button')[0]);
      // A chosen answer shows as chosen for a moment before the next question.
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
  }
  await screen.findByRole('heading', { name: 'Celeste' });
}
/** What was kept as done with picks, as [pick id, outcome], once the ids are in. */
async function outcomes() {
  await act(async () => {});
  return jest.mocked(recordPickOutcome).mock.calls;
}

it('offers leaving it to chance when picking for the queue, not when starting a game', () => {
  setup('play');
  expect(screen.queryByRole('button', { name: /Leave it to chance/ })).not.toBeInTheDocument();
});

it('rolls a random game, then adds it to the queue or rolls again', async () => {
  const { onPick, onClose } = setup('queue');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Leave it to chance/ }));
  });

  expect(screen.getByText('Left to chance')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Celeste' })).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Roll again/ }));
  });
  expect(findRandomBacklogGame).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByRole('button', { name: 'Add to Queue' }));
  expect(onPick).toHaveBeenCalledWith(celeste);
  expect(onClose).toHaveBeenCalled();
});

it("says so when there's nothing left to pick, and goes back to the questions", async () => {
  jest.mocked(findRandomBacklogGame).mockResolvedValue({ error: 'none' });
  setup('queue');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Leave it to chance/ }));
  });
  expect(screen.getByText(/no backlog game left to pick/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Change answers' }));
  expect(screen.getByRole('button', { name: /Leave it to chance/ })).toBeInTheDocument();
});

it('with a game playing, can play the pick now instead of queueing it', async () => {
  const { onPick, onPlayNow, onClose } = setup('queue');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Leave it to chance/ }));
  });

  fireEvent.click(screen.getByRole('button', { name: 'Play now' }));

  expect(onPlayNow).toHaveBeenCalledWith(celeste);
  expect(onPick).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it('says what it picked for screen readers, from a region that was already there', async () => {
  setup('queue');
  // Empty, but in the page before the pick: a region added with its text is often not read.
  const announcer = document.querySelector('[aria-live="polite"]')!;
  expect(announcer).toHaveTextContent('');

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Leave it to chance/ }));
  });
  await screen.findByRole('button', { name: 'Add to Queue' });

  expect(announcer).toHaveTextContent('Picked Celeste.');
});

describe('keeping the picks', () => {
  it('has each random pick kept as a pick for the queue, numbered as they come', async () => {
    setup('queue');
    await leaveToChance();
    expect(recordRandomPick).toHaveBeenCalledWith({ gameId: 4, mode: 'queue', attempt: 1 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll again/ }));
    });
    expect(recordRandomPick).toHaveBeenCalledTimes(2);
    expect(recordRandomPick).toHaveBeenLastCalledWith({ gameId: 4, mode: 'queue', attempt: 2 });
  });

  it('keeps rolling again as passing on the game it had landed on, and queueing as taking the next', async () => {
    setup('queue');
    await leaveToChance();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll again/ }));
    });
    expect(await outcomes()).toEqual([[41, 'rerolled']]);

    fireEvent.click(screen.getByRole('button', { name: 'Add to Queue' }));
    expect(await outcomes()).toEqual([
      [41, 'rerolled'],
      [42, 'queued'],
    ]);
  });

  it('keeps Play now as played, not queued', async () => {
    setup('queue');
    await leaveToChance();
    fireEvent.click(screen.getByRole('button', { name: 'Play now' }));
    expect(await outcomes()).toEqual([[41, 'played']]);
  });

  it('rolls once, and keeps one pick, however many times chance is pressed', async () => {
    setup('queue');
    await act(async () => {
      const button = screen.getByRole('button', { name: /Leave it to chance/ });
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(findRandomBacklogGame).toHaveBeenCalledTimes(1);
    expect(recordRandomPick).toHaveBeenCalledTimes(1);
  });

  it('keeps one answer for a pick, however many times its button is pressed', async () => {
    const { onClose } = setup('queue');
    await leaveToChance();
    const add = screen.getByRole('button', { name: 'Add to Queue' });
    fireEvent.click(add);
    fireEvent.click(add);
    fireEvent.click(screen.getByRole('button', { name: 'Play now' }));

    expect(onClose).toHaveBeenCalled();
    expect(await outcomes()).toEqual([[41, 'queued']]);
  });

  it('shows the game before the pick is kept, and keeps the answer once it is', async () => {
    let kept: (id: number | null) => void = () => {};
    jest.mocked(recordRandomPick).mockReturnValue(new Promise((resolve) => (kept = resolve)));
    const { onPick } = setup('queue');
    await leaveToChance();

    fireEvent.click(screen.getByRole('button', { name: 'Add to Queue' }));
    expect(onPick).toHaveBeenCalledWith(celeste);
    expect(await outcomes()).toEqual([]);

    kept(57);
    expect(await outcomes()).toEqual([[57, 'queued']]);
  });

  it('keeps no pick for a roll that ends after the picker was closed: nobody saw the game', async () => {
    let land: (found: { game: typeof celeste }) => void = () => {};
    jest.mocked(findRandomBacklogGame).mockReturnValue(new Promise((resolve) => (land = resolve)));
    const { unmount } = setup('queue');
    await leaveToChance();

    unmount();
    await act(async () => land({ game: celeste }));

    expect(recordRandomPick).not.toHaveBeenCalled();
    expect(await outcomes()).toEqual([]);
  });

  it('numbers the picks by the games shown: a roll that found nothing is not one of them', async () => {
    jest
      .mocked(findRandomBacklogGame)
      .mockResolvedValueOnce({ error: 'failed' })
      .mockResolvedValue({ game: celeste });
    setup('queue');
    await leaveToChance();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    });

    expect(recordRandomPick).toHaveBeenCalledTimes(1);
    expect(recordRandomPick).toHaveBeenCalledWith({ gameId: 4, mode: 'queue', attempt: 1 });
  });

  it("doesn't queue a game that is being rolled past: Roll again then Add to Queue at once", async () => {
    const { onPick, onClose } = setup('queue');
    await leaveToChance();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll again/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Add to Queue' }));
      fireEvent.click(screen.getByRole('button', { name: 'Play now' }));
    });

    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(await outcomes()).toEqual([[41, 'rerolled']]);
  });

  it("works the same when a random pick couldn't be kept", async () => {
    jest.mocked(recordRandomPick).mockResolvedValue(null);
    const { onPick } = setup('queue');
    await leaveToChance();
    fireEvent.click(screen.getByRole('button', { name: 'Add to Queue' }));

    expect(onPick).toHaveBeenCalledWith(celeste);
    expect(await outcomes()).toEqual([[null, 'queued']]);
  });

  it('keeps nothing when chance finds no game', async () => {
    jest.mocked(findRandomBacklogGame).mockResolvedValue({ error: 'none' });
    setup('queue');
    await leaveToChance();
    expect(recordRandomPick).not.toHaveBeenCalled();
    expect(await outcomes()).toEqual([]);
  });

  it('keeps nothing as done with a pick when the picker is closed without choosing', async () => {
    const { onClose } = setup('queue');
    await leaveToChance();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(await outcomes()).toEqual([]);
  });

  it('asks Pick My Game for a pick to play, and keeps starting it as played', async () => {
    const { onPick } = setup('play');
    await answerQuestions();

    const asked = mockFetch.mock.calls.find(([url]) => url === '/api/suggest')!;
    expect(JSON.parse(asked[1].body).mode).toBe('play');

    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    expect(onPick).toHaveBeenCalledWith(celeste);
    expect(await outcomes()).toEqual([[90, 'played']]);
  });

  it('asks Pick My Game for a pick for the queue, and keeps queueing it as queued', async () => {
    setup('queue');
    await answerQuestions();

    const asked = mockFetch.mock.calls.find(([url]) => url === '/api/suggest')!;
    expect(JSON.parse(asked[1].body).mode).toBe('queue');

    fireEvent.click(screen.getByRole('button', { name: 'Add to Queue' }));
    expect(await outcomes()).toEqual([[90, 'queued']]);
  });

  it("keeps Pick My Game's pick played now as played", async () => {
    setup('queue');
    await answerQuestions();
    fireEvent.click(screen.getByRole('button', { name: 'Play now' }));
    expect(await outcomes()).toEqual([[90, 'played']]);
  });
});

describe('with the AI features turned off (random only)', () => {
  it('opens straight on a random pick, with no questions and nothing asked of a model', async () => {
    const { onPick, onClose } = setup('queue', true);
    await act(async () => {});

    expect(screen.getByRole('heading', { name: 'Celeste' })).toBeInTheDocument();
    expect(screen.getByText('Left to chance')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(findRandomBacklogGame).toHaveBeenCalledTimes(1);
    expect(recordRandomPick).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalledWith('/api/suggest', expect.anything());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add to Queue/i }));
    });
    expect(onPick).toHaveBeenCalledWith(celeste);
    expect(onClose).toHaveBeenCalled();
  });

  it('rolls again from the game it landed on', async () => {
    setup('queue', true);
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll again/ }));
    });
    expect(findRandomBacklogGame).toHaveBeenCalledTimes(2);
  });

  it('has no questions to go back to when nothing is left to pick: only trying again', async () => {
    jest.mocked(findRandomBacklogGame).mockResolvedValue({ error: 'none' });
    setup('queue', true);
    await act(async () => {});

    expect(screen.getByRole('alert')).toHaveTextContent(/no backlog game left to pick/);
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change answers' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

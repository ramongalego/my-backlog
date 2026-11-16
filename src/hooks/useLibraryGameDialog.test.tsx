import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useLibraryGameDialog } from '@/hooks/useLibraryGameDialog';
import { libraryGame as game } from '@/lib/account/test-games';
import { queryKeys } from '@/lib/query-keys';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

const mutate = jest.fn();
jest.mock('@/hooks/useGameMutations', () => ({
  useSetGameStatus: () => ({ mutate }),
}));
// The queue, "play this instead" and console parts have their own tests; here
// it's what they're told about the game.
const dialogFor = jest.fn((...args: unknown[]) => ({ art: { gameId: 0 }, told: args }));
jest.mock('@/hooks/useGameDialog', () => ({ useGameDialog: () => dialogFor }));

const library = [
  game({ id: 1, name: 'Celeste' }),
  game({
    id: 2,
    name: 'Hades',
    status: 'finished',
    rating: 9,
    notes: 'Loved it',
    finished_at: '2026-10-19T12:00:00+00:00',
  }),
  game({
    id: 3,
    name: 'Super Meat Boy',
    status: 'dropped',
    dropped_at: '2026-04-11T08:00:00+00:00',
  }),
];

function setup() {
  const client = new QueryClient();
  client.setQueryData(queryKeys.games.list('user-1'), library);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useLibraryGameDialog('user-1'), { wrapper });
  return { dialog: () => hook.result.current, client };
}

beforeEach(() => jest.clearAllMocks());

it('has no dialog until a game is opened', () => {
  expect(setup().dialog().gameDialog).toBeNull();
});

it('opens a game as it is: its status, and a finished game with its date, notes and rating', () => {
  const { dialog } = setup();
  act(() => dialog().openGame(2));
  expect(dialog().gameDialog).toMatchObject({
    game: { id: 2, name: 'Hades' },
    initialStatus: 'finished',
    initialDate: '2026-10-19',
    initialNotes: 'Loved it',
    initialRating: 9,
  });
});

it('gives a dropped game the day it was dropped, and a backlog game no date', () => {
  const { dialog } = setup();
  act(() => dialog().openGame(3));
  expect(dialog().gameDialog).toMatchObject({
    initialStatus: 'dropped',
    initialDate: '2026-04-11',
  });

  act(() => dialog().openGame(1));
  expect(dialog().gameDialog).toMatchObject({ initialStatus: 'backlog', initialDate: null });
});

it('tells the shared dialog parts where the game is now, for Undo after playing it instead', () => {
  const { dialog } = setup();
  act(() => dialog().openGame(2));
  expect(dialogFor).toHaveBeenLastCalledWith(expect.objectContaining({ id: 2 }), {
    status: 'finished',
    from: { status: 'finished', date: '2026-10-19', notes: 'Loved it', rating: 9 },
  });
});

it('saves a change through the status change every page uses, for the game opened', () => {
  const { dialog } = setup();
  act(() => dialog().openGame(1));
  act(() => dialog().gameDialog?.onConfirm?.('finished', '2026-11-16', 'Great', 10));
  expect(mutate).toHaveBeenCalledWith({
    gameId: 1,
    status: 'finished',
    date: '2026-11-16',
    notes: 'Great',
    rating: 10,
  });
});

it('keeps the game as it was when opened, whatever the list does meanwhile', () => {
  const { dialog, client } = setup();
  act(() => dialog().openGame(1));
  act(() =>
    client.setQueryData(queryKeys.games.list('user-1'), [game({ id: 1, name: 'Renamed' })]),
  );
  expect(dialog().gameDialog?.game.name).toBe('Celeste');
});

it('closes, and does nothing for a game that is not in the library', () => {
  const { dialog } = setup();
  act(() => dialog().openGame(99));
  expect(dialog().gameDialog).toBeNull();

  act(() => dialog().openGame(1));
  act(() => dialog().gameDialog?.onClose?.());
  expect(dialog().gameDialog).toBeNull();
});

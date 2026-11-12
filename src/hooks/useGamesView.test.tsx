import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { renderHook } from '@testing-library/react';
import { GamesViewProvider, useGamesView } from '@/hooks/useGamesView';
import { parseGamesView } from '@/lib/games/games-view';

const clearCookie = () => {
  document.cookie = 'games-view=; path=/; max-age=0';
};

beforeEach(clearCookie);
afterAll(clearCookie);

it('is the grid until the player picks the list', () => {
  expect(renderHook(() => useGamesView()).result.current[0]).toBe('grid');
});

it('remembers the choice in a cookie, and every user of it follows', () => {
  const first = renderHook(() => useGamesView());
  const second = renderHook(() => useGamesView());

  act(() => first.result.current[1]('list'));

  expect(document.cookie).toContain('games-view=list');
  expect(first.result.current[0]).toBe('list');
  expect(second.result.current[0]).toBe('list');
  // A later visit starts from it.
  expect(renderHook(() => useGamesView()).result.current[0]).toBe('list');
});

it('loads a page in the view the server drew it in', async () => {
  document.cookie = 'games-view=list; path=/';
  function Page() {
    return <p>{useGamesView()[0]}</p>;
  }
  const tree = (
    <GamesViewProvider value="list">
      <Page />
    </GamesViewProvider>
  );
  const container = document.createElement('div');
  container.innerHTML = renderToString(tree);
  expect(container.textContent).toBe('list');

  const mismatches: unknown[] = [];
  await act(async () => {
    hydrateRoot(container, tree, { onRecoverableError: (e) => mismatches.push(e) });
  });

  expect(mismatches).toEqual([]);
  expect(container.textContent).toBe('list');
});

it('reads only the views it knows', () => {
  expect(parseGamesView('list')).toBe('list');
  expect(parseGamesView('grid')).toBe('grid');
  expect(parseGamesView('table')).toBe('grid');
  expect(parseGamesView(undefined)).toBe('grid');
});

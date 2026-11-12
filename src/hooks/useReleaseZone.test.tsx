import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { renderHook } from '@testing-library/react';
import { useReleaseZone } from '@/hooks/useReleaseZone';
import { upcomingRelease } from '@/lib/games/release-date';

/** Pretends the player's clock is `hours` ahead of UTC (behind, if negative). */
function offsetFromUtc(hours: number) {
  for (const part of ['FullYear', 'Month', 'Date'] as const) {
    jest.spyOn(Date.prototype, `get${part}`).mockImplementation(function (this: Date) {
      return new Date(this.getTime() + hours * 3_600_000)[`getUTC${part}`]();
    });
  }
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('reads in UTC while the player is on the same day as UTC, so nothing renders twice', () => {
  jest.useFakeTimers().setSystemTime(Date.UTC(2026, 11, 2, 12, 0));
  offsetFromUtc(9); // Tokyo, 21:00 on the same day

  expect(renderHook(() => useReleaseZone()).result.current).toBe('utc');
});

it("reads in the player's own day once it differs from UTC's", () => {
  jest.useFakeTimers().setSystemTime(Date.UTC(2026, 11, 2, 23, 30));
  offsetFromUtc(1); // Madrid, 00:30 on the third

  expect(renderHook(() => useReleaseZone()).result.current).toBe('local');
});

it('loads a page as the server rendered it, then shows the player their own day', async () => {
  jest.useFakeTimers().setSystemTime(Date.UTC(2026, 11, 2, 23, 30));
  // Out on the third: tomorrow for the server, today for a player in Madrid.
  function Badge() {
    const zone = useReleaseZone();
    return <p>{zone === 'utc' ? 'server day' : 'player day'}</p>;
  }

  // The server renders in UTC whatever its own clock says.
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Badge />);
  expect(container.textContent).toBe('server day');
  expect(upcomingRelease('Dec 3, 2026', Date.now(), 'utc')?.label).toBe('Out tomorrow');

  offsetFromUtc(1);
  const mismatches: unknown[] = [];
  await act(async () => {
    hydrateRoot(container, <Badge />, { onRecoverableError: (e) => mismatches.push(e) });
  });

  // No mismatch on the way in, and the player's day straight after.
  expect(mismatches).toEqual([]);
  expect(container.textContent).toBe('player day');
});

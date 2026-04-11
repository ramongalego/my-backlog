import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { useLibraryRefresh, PLAYTIME_REFRESH_KEY } from '@/hooks/useLibraryRefresh';
import { useInvalidateQueries } from '@/lib/mutations';
import { reloadPage } from '@/lib/reload';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/lib/mutations');

jest.mock('@/lib/reload', () => ({
  reloadPage: jest.fn(),
}));

const mockGamesAndQueue = jest.fn();
const mockReload = reloadPage as jest.Mock;
const originalFetch = global.fetch;

afterAll(() => {
  global.fetch = originalFetch;
});

function mockSuccessResponse(payload: { newGames: number; updatedPlaytime: number }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
}

describe('useLibraryRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (useInvalidateQueries as jest.Mock).mockReturnValue({
      gamesAndQueue: mockGamesAndQueue,
      games: jest.fn(),
      queue: jest.fn(),
    });
  });

  describe('manual refresh', () => {
    it('shows "updated playtime" toast when games changed', async () => {
      mockSuccessResponse({ newGames: 0, updatedPlaytime: 3 });

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refresh({ manual: true });
      });

      expect(toast.success).toHaveBeenCalledWith('Updated playtime for 3 games');
      expect(mockGamesAndQueue).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(PLAYTIME_REFRESH_KEY)).toBeTruthy();
    });

    it('singularizes the toast for exactly one updated game', async () => {
      mockSuccessResponse({ newGames: 0, updatedPlaytime: 1 });

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refresh({ manual: true });
      });

      expect(toast.success).toHaveBeenCalledWith('Updated playtime for 1 game');
    });

    it('shows "up to date" toast when nothing changed', async () => {
      mockSuccessResponse({ newGames: 0, updatedPlaytime: 0 });

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refresh({ manual: true });
      });

      expect(toast.success).toHaveBeenCalledWith('Your library is up to date');
      expect(mockGamesAndQueue).toHaveBeenCalledTimes(1);
    });

    it('reloads the page when new games were added, without showing a toast', async () => {
      mockSuccessResponse({ newGames: 2, updatedPlaytime: 0 });

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refresh({ manual: true });
      });

      expect(mockReload).toHaveBeenCalledTimes(1);
      expect(toast.success).not.toHaveBeenCalled();
      expect(mockGamesAndQueue).not.toHaveBeenCalled();
    });

    it('shows an error toast when the endpoint returns non-ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });

      const { result } = renderHook(() => useLibraryRefresh());
      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refresh({ manual: true });
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to refresh library');
      expect(refreshResult).toEqual({ success: false, newGames: 0, updatedPlaytime: 0 });
      expect(mockGamesAndQueue).not.toHaveBeenCalled();
    });

    it('shows an error toast on a network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refresh({ manual: true });
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to refresh library');
      expect(mockGamesAndQueue).not.toHaveBeenCalled();
    });
  });

  describe('auto refresh (non-manual)', () => {
    it('does not show any toast on successful refresh', async () => {
      mockSuccessResponse({ newGames: 0, updatedPlaytime: 5 });

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refresh();
      });

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(mockGamesAndQueue).toHaveBeenCalledTimes(1);
    });

    it('does not show an error toast on failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refresh();
      });

      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('refreshIfStale', () => {
    it('skips the refresh when the timestamp is within the stale window', async () => {
      localStorage.setItem(PLAYTIME_REFRESH_KEY, String(Date.now() - 30 * 60 * 1000));
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refreshIfStale();
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockGamesAndQueue).not.toHaveBeenCalled();
    });

    it('fires the refresh when the timestamp is older than one hour', async () => {
      localStorage.setItem(PLAYTIME_REFRESH_KEY, String(Date.now() - 2 * 60 * 60 * 1000));
      mockSuccessResponse({ newGames: 0, updatedPlaytime: 0 });

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refreshIfStale();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/steam/refresh', { method: 'POST' });
      expect(mockGamesAndQueue).toHaveBeenCalledTimes(1);
    });

    it('fires the refresh when there is no stored timestamp', async () => {
      mockSuccessResponse({ newGames: 0, updatedPlaytime: 0 });

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refreshIfStale();
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('never shows toasts, even when the underlying refresh succeeds', async () => {
      mockSuccessResponse({ newGames: 0, updatedPlaytime: 2 });

      const { result } = renderHook(() => useLibraryRefresh());
      await act(async () => {
        await result.current.refreshIfStale();
      });

      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});

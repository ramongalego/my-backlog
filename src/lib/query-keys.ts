export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },
  games: {
    all: ['games'] as const,
    list: (userId: string) => [...queryKeys.games.all, 'list', userId] as const,
    diary: (userId: string) => [...queryKeys.games.all, 'diary', userId] as const,
    playing: (userId: string) => [...queryKeys.games.all, 'playing', userId] as const,
    manual: (userId: string) => [...queryKeys.games.all, 'manual', userId] as const,
    openEndedCategories: (userId: string) =>
      [...queryKeys.games.all, 'open-ended-categories', userId] as const,
    // Under games, so any change to the library asks the server again (which
    // only rewrites it when something it talks about changed).
    insight: (userId: string, tone: string) =>
      [...queryKeys.games.all, 'insight', userId, tone] as const,
  },
  queue: {
    all: ['queue'] as const,
    list: (userId: string) => [...queryKeys.queue.all, 'list', userId] as const,
  },
  library: {
    all: ['library'] as const,
    meta: (userId: string) => [...queryKeys.library.all, 'meta', userId] as const,
  },
  igdb: {
    game: (igdbId: number) => ['igdb', 'game', igdbId] as const,
  },
  carousels: {
    all: ['carousels'] as const,
    byUser: (userId: string) => [...queryKeys.carousels.all, userId] as const,
  },
};

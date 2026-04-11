export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },
  games: {
    all: ['games'] as const,
    list: () => [...queryKeys.games.all, 'list'] as const,
    diary: () => [...queryKeys.games.all, 'diary'] as const,
    stats: () => [...queryKeys.games.all, 'stats'] as const,
    playing: (userId: string) => [...queryKeys.games.all, 'playing', userId] as const,
  },
  queue: {
    all: ['queue'] as const,
    list: (userId: string) => [...queryKeys.queue.all, 'list', userId] as const,
    ids: () => [...queryKeys.queue.all, 'ids'] as const,
  },
  library: {
    all: ['library'] as const,
    meta: (userId: string) => [...queryKeys.library.all, 'meta', userId] as const,
  },
  carousels: {
    all: ['carousels'] as const,
    byUser: (userId: string) => [...queryKeys.carousels.all, userId] as const,
  },
};

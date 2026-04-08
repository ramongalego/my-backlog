export const queryKeys = {
  games: {
    all: ['games'] as const,
    list: () => [...queryKeys.games.all, 'list'] as const,
    diary: () => [...queryKeys.games.all, 'diary'] as const,
    stats: () => [...queryKeys.games.all, 'stats'] as const,
    playing: () => [...queryKeys.games.all, 'playing'] as const,
  },
  queue: {
    all: ['queue'] as const,
    list: () => [...queryKeys.queue.all, 'list'] as const,
    ids: () => [...queryKeys.queue.all, 'ids'] as const,
  },
  library: {
    all: ['library'] as const,
    meta: (userId: string) => [...queryKeys.library.all, 'meta', userId] as const,
  },
  carousels: {
    all: (userId: string) => ['carousels', userId] as const,
  },
};

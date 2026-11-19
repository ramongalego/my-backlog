export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
    hasPassword: (userId: string) => [...queryKeys.auth.all, 'has-password', userId] as const,
  },
  games: {
    all: ['games'] as const,
    list: (userId: string) => [...queryKeys.games.all, 'list', userId] as const,
    diary: (userId: string) => [...queryKeys.games.all, 'diary', userId] as const,
    playing: (userId: string) => [...queryKeys.games.all, 'playing', userId] as const,
    // Under games: removing a game takes it off the favorites.
    favorites: (userId: string) => [...queryKeys.games.all, 'favorites', userId] as const,
    manual: (userId: string) => [...queryKeys.games.all, 'manual', userId] as const,
    // Under games: a change to a game is a new event.
    history: (userId: string) => [...queryKeys.games.all, 'history', userId] as const,
    // Under games: a pick is started by a change to a game.
    playedPicks: (userId: string) => [...queryKeys.games.all, 'played-picks', userId] as const,
    openEndedCategories: (userId: string) =>
      [...queryKeys.games.all, 'open-ended-categories', userId] as const,
  },
  // Not under games: a library change doesn't change what's saved, only
  // whether it's out of date, which Stats works out from the games list.
  insights: (userId: string) => ['insights', userId] as const,
  queue: {
    all: ['queue'] as const,
    list: (userId: string) => [...queryKeys.queue.all, 'list', userId] as const,
  },
  library: {
    all: ['library'] as const,
    meta: (userId: string) => [...queryKeys.library.all, 'meta', userId] as const,
  },
  // Not under games: SteamGridDB's answer doesn't change with the library.
  gameArt: (gameId: number) => ['game-art', gameId] as const,
  /** For a game being added, which has no id of ours yet. */
  addingArt: (igdbId: number) => ['game-art', 'adding', igdbId] as const,
  igdb: {
    game: (igdbId: number) => ['igdb', 'game', igdbId] as const,
  },
  carousels: {
    all: ['carousels'] as const,
    byUser: (userId: string) => [...queryKeys.carousels.all, userId] as const,
  },
};

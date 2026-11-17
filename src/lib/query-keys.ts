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
    // The games picked as favorites. Under games: removing a game takes it
    // off them, so a change to the library asks again.
    favorites: (userId: string) => [...queryKeys.games.all, 'favorites', userId] as const,
    manual: (userId: string) => [...queryKeys.games.all, 'manual', userId] as const,
    // The latest of the history (game_events), for the Profile page's
    // activity. Under games: a change to a game is a new event.
    history: (userId: string) => [...queryKeys.games.all, 'history', userId] as const,
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
  // The images a game's art can be chosen from (Choose art). Not under games:
  // it's SteamGridDB's answer, which a change to the library doesn't change.
  gameArt: (gameId: number) => ['game-art', gameId] as const,
  /** The choices for a game being added, which has no id of ours yet. */
  addingArt: (igdbId: number) => ['game-art', 'adding', igdbId] as const,
  igdb: {
    game: (igdbId: number) => ['igdb', 'game', igdbId] as const,
  },
  carousels: {
    all: ['carousels'] as const,
    byUser: (userId: string) => [...queryKeys.carousels.all, userId] as const,
  },
};

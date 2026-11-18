import type { QueryClient } from '@tanstack/react-query';
import type { GameWithImage, QueueItem } from '@/types/games';

// Every queue and playing-game mutation shares this scope, so React Query runs
// them one at a time: two quick reorders can't reach the server out of order or
// roll back over each other.
export const QUEUE_SCOPE = { id: 'queue' };

/**
 * One toast for every queue or playing-game change, so only the latest can be
 * undone: undoing an older one after a newer one puts games a place off.
 */
export const QUEUE_UNDO_TOAST = 'queue-undo';

/**
 * Only the last queue change to settle reads the queue back: reading it after
 * an earlier one undoes the later ones on screen (a removed game flickers back).
 * Call it as a change settles, while it still counts as in flight.
 */
export function moreQueueChangesWaiting(queryClient: QueryClient): boolean {
  const inFlight = queryClient.isMutating({
    predicate: (mutation) => mutation.options.scope?.id === QUEUE_SCOPE.id,
  });
  return inFlight > 1;
}

/** Enough to show a game in the queue before the server responds. */
export type QueueableGame = Pick<
  GameWithImage,
  'id' | 'app_id' | 'name' | 'header_image' | 'main_story_hours' | 'playtime_forever'
> &
  Partial<
    Pick<
      GameWithImage,
      | 'steam_review_score'
      | 'steam_review_count'
      | 'critic_score'
      | 'critic_count'
      | 'deck_compat'
      | 'last_played_at'
      | 'release_date'
      | 'source'
      | 'platform'
      | 'started_at'
    >
  >;

export function toQueueItem(game: QueueableGame, position: number): QueueItem {
  return {
    id: -game.id,
    game_id: game.id,
    position,
    game: {
      app_id: game.app_id,
      name: game.name,
      header_image: game.header_image,
      playtime_forever: game.playtime_forever,
      main_story_hours: game.main_story_hours,
      steam_review_score: game.steam_review_score ?? null,
      steam_review_count: game.steam_review_count ?? null,
      critic_score: game.critic_score ?? null,
      critic_count: game.critic_count ?? null,
      deck_compat: game.deck_compat ?? null,
      last_played_at: game.last_played_at ?? null,
      release_date: game.release_date ?? null,
      // The console tag and Steam details depend on these.
      source: game.source,
      platform: game.platform,
      started_at: game.started_at ?? null,
    },
  };
}

export function toPlayingGame(item: QueueItem): GameWithImage {
  return {
    id: item.game_id,
    app_id: item.game.app_id,
    name: item.game.name,
    header_image: item.game.header_image,
    main_story_hours: item.game.main_story_hours,
    playtime_forever: item.game.playtime_forever,
    // A paused game carries on from when it was first started.
    started_at: item.game.started_at ?? null,
    steam_review_score: item.game.steam_review_score,
    steam_review_count: item.game.steam_review_count ?? null,
    critic_score: item.game.critic_score ?? null,
    critic_count: item.game.critic_count ?? null,
    deck_compat: item.game.deck_compat ?? null,
    last_played_at: item.game.last_played_at ?? null,
    release_date: item.game.release_date ?? null,
    source: item.game.source,
    platform: item.game.platform,
  };
}

export function fromQueueItem(item: QueueItem): QueueableGame {
  return { id: item.game_id, ...item.game };
}

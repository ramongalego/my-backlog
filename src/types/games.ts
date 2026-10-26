export interface Profile {
  steam_id: string | null;
  steam_username: string | null;
  steam_avatar: string | null;
}

export interface Game {
  app_id: number;
  name: string;
  type?: string | null;
  categories?: string[] | null;
  header_image?: string | null;
}

export interface GameWithImage {
  /** The game's row id: how the app identifies a game. */
  id: number;
  /** Steam's app id, for Steam games only (store links). */
  app_id: number | null;
  /** 'steam' or 'manual'; with platform, which console a game added by hand is on. */
  source?: string;
  platform?: string | null;
  name: string;
  header_image: string | null;
  main_story_hours: number | null;
  playtime_forever: number;
  started_at?: string | null;
  steam_review_score?: number | null;
  steam_review_count?: number | null;
  deck_compat?: number | null;
  last_played_at?: string | null;
}

export interface SyncProgress {
  current: number;
  total: number;
}

export interface QueueItem {
  /** The queue row's id. */
  id: number;
  game_id: number;
  position: number;
  game: {
    app_id: number | null;
    source?: string;
    platform?: string | null;
    name: string;
    header_image: string | null;
    playtime_forever: number;
    main_story_hours: number | null;
    steam_review_score: number | null;
    steam_review_count?: number | null;
    deck_compat?: number | null;
    last_played_at?: string | null;
  };
}

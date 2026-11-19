export interface Profile {
  steam_id: string | null;
  steam_username: string | null;
  steam_avatar: string | null;
  /** The name the player chose, in place of the Steam one (or their email's). */
  display_name: string | null;
  /** The picture the player uploaded, in place of Steam's (or their initial). */
  avatar_url: string | null;
  /** The name in the profile's address. Every profile has one; null only until it's read. */
  username: string | null;
  /** Other people can't see the profile (/u/<username>). Null only until it's read. */
  is_private: boolean | null;
}

export interface Game {
  app_id: number;
  name: string;
  type?: string | null;
  categories?: string[] | null;
  header_image?: string | null;
}

export interface GameWithImage {
  /** The row id, not Steam's app_id. */
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
  critic_score?: number | null;
  critic_count?: number | null;
  deck_compat?: number | null;
  last_played_at?: string | null;
  release_date?: string | null;
}

export interface SyncProgress {
  current: number;
  total: number;
}

export interface QueueItem {
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
    critic_score?: number | null;
    critic_count?: number | null;
    deck_compat?: number | null;
    last_played_at?: string | null;
    release_date?: string | null;
    /** Set while the game is paused: switched away from, waiting to be picked up again. */
    started_at?: string | null;
  };
}

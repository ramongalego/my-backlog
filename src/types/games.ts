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
}

export interface GameWithImage {
  app_id: number;
  name: string;
  header_image: string | null;
  main_story_hours: number;
  playtime_forever: number;
  started_at?: string | null;
  steam_review_score?: number | null;
  steam_review_count?: number | null;
}

export interface SyncProgress {
  current: number;
  total: number;
}

export interface QueueItem {
  id: number;
  app_id: number;
  position: number;
  game: {
    name: string;
    header_image: string | null;
    playtime_forever: number;
    main_story_hours: number | null;
    steam_review_score: number | null;
  };
}

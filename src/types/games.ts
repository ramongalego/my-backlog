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
}

export interface SyncProgress {
  current: number;
  total: number;
}

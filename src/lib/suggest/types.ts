export type MoodType = 'adrenaline' | 'relaxed' | 'engaged' | 'emotional';

export type EnergyLevel = 'high' | 'medium' | 'low';

export type TimeCommitment = 'short' | 'medium' | 'long';

export interface SuggestionPreferences {
  mood: MoodType;
  energy: EnergyLevel;
  time: TimeCommitment;
}

export interface GameForSuggestion {
  app_id: number;
  name: string;
  genres: string[] | null;
  categories: string[] | null;
  tags: string[] | null;
  main_story_hours: number | null;
  playtime_forever: number;
  steam_review_weighted: number | null;
  reroll_count: number;
}

export interface TagAffinity {
  tag: string;
  completionRate: number;
  finished: number;
  total: number;
}

export interface FinishedGame {
  name: string;
  rating: number | null;
}

export interface SuggestionContext {
  preferences: SuggestionPreferences;
  backlogGames: GameForSuggestion[];
  finishedGames: FinishedGame[];
  droppedGames: string[];
  excludeAppIds: number[];
  previousReasonings: string[];
  tagAffinities: TagAffinity[];
}

export interface SuggestionResult {
  game: {
    app_id: number;
    name: string;
    header_image: string | null;
    main_story_hours: number | null;
    genres: string[] | null;
    tags: string[] | null;
    steam_review_score: number | null;
  };
  reasoning: string;
}

export interface SuggestionAPIResponse {
  success: true;
  data: SuggestionResult;
}

export interface SuggestionAPIError {
  success: false;
  error: string;
}

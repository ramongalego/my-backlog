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
  main_story_hours: number | null;
  playtime_forever: number;
  steam_review_weighted: number | null;
  reroll_count: number;
}

export interface SuggestionContext {
  preferences: SuggestionPreferences;
  backlogGames: GameForSuggestion[];
  finishedGames: string[];
  droppedGames: string[];
  excludeAppIds: number[];
  previousReasonings: string[];
}

export interface SuggestionResult {
  game: {
    app_id: number;
    name: string;
    header_image: string | null;
    main_story_hours: number | null;
    genres: string[] | null;
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

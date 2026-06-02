import type { z } from 'zod';
import type { suggestRequestSchema } from '@/lib/validations/suggest';

// Derived from the zod schema so the allowed values live in exactly one place.
// (Used only in type position, so this import is erased at compile time.)
type SuggestRequest = z.infer<typeof suggestRequestSchema>;

export type MoodType = SuggestRequest['mood'];

export type EnergyLevel = SuggestRequest['energy'];

export type TimeCommitment = SuggestRequest['time'];

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
  excludeAppIds: Set<number>;
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

import type { z } from 'zod';
import type { suggestRequestSchema } from '@/lib/validations/suggest';
import type { CandidateGame, ScoredCandidate } from './shortlist';

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

export interface GameForSuggestion extends CandidateGame {
  steam_review_score: number | null;
  steam_review_count: number | null;
}

export interface FinishedGame {
  name: string;
  rating: number | null;
}

export interface SuggestionContext {
  preferences: SuggestionPreferences;
  /** The scored shortlist, already filtered and shuffled. */
  candidates: ScoredCandidate<GameForSuggestion>[];
  finishedGames: FinishedGame[];
  droppedGames: string[];
  previousReasonings: string[];
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
    steam_review_count: number | null;
    playtime_forever: number;
    last_played_at: string | null;
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

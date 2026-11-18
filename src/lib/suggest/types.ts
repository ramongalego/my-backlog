import type { z } from 'zod';
import type { pickOutcomeSchema, suggestRequestSchema } from '@/lib/validations/suggest';
import type { CandidateGame, ScoredCandidate } from './shortlist';

// From the zod schema, so the allowed values live in one place.
type SuggestRequest = z.infer<typeof suggestRequestSchema>;

export type MoodType = SuggestRequest['mood'];

export type EnergyLevel = SuggestRequest['energy'];

export type TimeCommitment = SuggestRequest['time'];

/** What a pick is for: to play now, or for the queue while another game is played. */
export type PickMode = SuggestRequest['mode'];

/** What the player did with a pick: started it, queued it, rolled again, or never saw it. */
export type PickOutcome = z.infer<typeof pickOutcomeSchema>['outcome'];

export interface SuggestionPreferences {
  mood: MoodType;
  energy: EnergyLevel;
  time: TimeCommitment;
}

export interface GameForSuggestion extends CandidateGame {
  steam_review_score: number | null;
  steam_review_count: number | null;
  critic_score: number | null;
  critic_count: number | null;
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
    id: number;
    app_id: number | null;
    name: string;
    header_image: string | null;
    main_story_hours: number | null;
    genres: string[] | null;
    tags: string[] | null;
    steam_review_score: number | null;
    steam_review_count: number | null;
    critic_score: number | null;
    critic_count: number | null;
    playtime_forever: number;
    last_played_at: string | null;
    /** Where it's played: a Steam game moved to a console doesn't link to Steam. */
    source?: string;
    platform?: string | null;
  };
  reasoning: string;
  /** The pick as kept by the server (game_picks.id); null when it couldn't be kept. */
  pickId?: number | null;
}

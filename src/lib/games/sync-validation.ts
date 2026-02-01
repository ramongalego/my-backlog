export interface SyncInput {
  appId: unknown;
}

export interface SyncValidationResult {
  valid: boolean;
  error?: string;
  appId?: number;
}

/**
 * Validates the input for a game sync request
 */
export function validateSyncInput(input: SyncInput): SyncValidationResult {
  const { appId } = input;

  if (!appId || typeof appId !== 'number' || !Number.isInteger(appId) || appId <= 0) {
    return { valid: false, error: 'Invalid appId' };
  }

  return { valid: true, appId };
}

/**
 * Determines if a game type should skip HLTB and Steam review fetching
 * Only actual games get this enriched data, not DLC or software
 */
export function shouldSkipEnrichment(type: string | null): boolean {
  return type !== 'game';
}

/**
 * Determines which external APIs to call based on game type
 */
export function getEnrichmentStrategy(type: string | null): {
  fetchHLTB: boolean;
  fetchSteamReviews: boolean;
} {
  const isGame = type === 'game';
  return {
    fetchHLTB: isGame,
    fetchSteamReviews: isGame,
  };
}

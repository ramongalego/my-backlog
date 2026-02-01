export const VALID_STATUSES = ['backlog', 'playing', 'finished', 'dropped', 'hidden'] as const;
export type GameStatus = typeof VALID_STATUSES[number];

export interface StatusUpdateInput {
  appId: unknown;
  status: unknown;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: {
    appId: number;
    status: GameStatus;
  };
}

/**
 * Validates the input for a game status update
 */
export function validateStatusUpdate(input: StatusUpdateInput): ValidationResult {
  const { appId, status } = input;

  // Validate appId
  if (!appId || typeof appId !== 'number' || !Number.isInteger(appId) || appId <= 0) {
    return { valid: false, error: 'Invalid appId' };
  }

  // Validate status presence
  if (!status) {
    return { valid: false, error: 'Missing status' };
  }

  // Validate status value
  if (!VALID_STATUSES.includes(status as GameStatus)) {
    return { valid: false, error: 'Invalid status' };
  }

  return {
    valid: true,
    data: {
      appId: appId as number,
      status: status as GameStatus,
    },
  };
}

/**
 * Checks if setting a game to "playing" status requires clearing other playing games
 */
export function requiresClearingPlayingGames(status: GameStatus): boolean {
  return status === 'playing';
}

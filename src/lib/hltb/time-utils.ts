/**
 * Converts seconds to hours with 1 decimal place precision
 * Used for HLTB comp_main values which are in seconds
 */
export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}

/** HLTB times are in seconds; rounded to one decimal place. */
export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}

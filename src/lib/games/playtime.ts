/** The most hours played a game can be given by hand. */
export const MAX_HOURS_PLAYED = 100000;

/**
 * To a tenth under 10 hours, so half an hour entered still shows ("6.5h"). Used
 * everywhere, so a card agrees with the game's dialog.
 */
export function playedHours(minutes: number): number {
  const hours = minutes / 60;
  return hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours);
}

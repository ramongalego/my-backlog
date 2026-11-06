/**
 * Hours played, as shown: to a tenth under 10 hours, where half an hour you
 * entered still shows ("6.5h played"), whole hours from 10 ("12h", "130h").
 * The same figure on every card, so a card agrees with the game's dialog.
 */
export function playedHours(minutes: number): number {
  const hours = minutes / 60;
  return hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours);
}

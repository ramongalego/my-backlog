/** The thresholds Steam documents for its store pages. */
export function steamReviewLabel(percentPositive: number, count: number): string | null {
  if (count < 10) return null;
  if (percentPositive >= 95 && count >= 500) return 'Overwhelmingly Positive';
  if (percentPositive >= 80) return count >= 50 ? 'Very Positive' : 'Positive';
  if (percentPositive >= 70) return 'Mostly Positive';
  if (percentPositive >= 40) return 'Mixed';
  if (percentPositive >= 20) return 'Mostly Negative';
  if (count >= 500) return 'Overwhelmingly Negative';
  return count >= 50 ? 'Very Negative' : 'Negative';
}

/** Hover text for a Steam score. */
export function steamReviewTitle(percentPositive: number, count?: number | null): string {
  if (count == null) return `${percentPositive}% positive Steam reviews`;
  const reviews = `${count.toLocaleString('en-US')} Steam review${count === 1 ? '' : 's'}`;
  const label = steamReviewLabel(percentPositive, count);
  return label ? `${label} · ${reviews}` : `${percentPositive}% positive · ${reviews}`;
}

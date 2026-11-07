// Numbers as Stats writes them.

export const count = (n: number) => n.toLocaleString('en-US');
export const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? '' : 's'}`;

export function formatYears(years: number): string {
  if (years < 1) return 'under a year';
  const rounded = years < 10 ? Math.round(years * 10) / 10 : Math.round(years);
  return `~${rounded} year${rounded === 1 ? '' : 's'}`;
}

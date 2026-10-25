// Steam files some software under type "game" (Wallpaper Engine, Spriter Pro,
// Marmoset Hexels). Its genres and leading tags give it away.
const SOFTWARE = new Set([
  'Utilities',
  'Software',
  'Animation & Modeling',
  'Design & Illustration',
  'Video Production',
  'Audio Production',
  'Photo Editing',
  'Web Publishing',
  'Software Training',
  'Game Development',
]);

export function isSoftware(app: { genres: string[] | null; tags: string[] | null }) {
  return (
    (app.genres ?? []).some((g) => SOFTWARE.has(g)) ||
    (app.tags ?? []).slice(0, 3).some((t) => SOFTWARE.has(t))
  );
}

/** Steam's app type, with software it calls a "game" filed as 'software'. */
export function classifyAppType(
  type: string | null,
  app: { genres: string[] | null; tags: string[] | null },
): string | null {
  return type === 'game' && isSoftware(app) ? 'software' : type;
}

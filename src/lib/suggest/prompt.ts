import type { HistoryGame, ScoredCandidate } from './shortlist';
import type { FinishedGame, GameForSuggestion, SuggestionContext } from './types';

const MOOD_DESCRIPTIONS = {
  adrenaline: 'fast, demanding, focus-heavy, skill or reaction based gameplay',
  relaxed: 'low pressure, cozy, forgiving gameplay with no stress',
  engaged: 'thinking, planning, problem-solving, meaningful choices',
  emotional: 'story-first, atmospheric, character-driven, memorable moments',
};

const ENERGY_DESCRIPTIONS = {
  high: 'complex systems to learn, optimization, deep mechanics',
  medium: 'familiar mechanics with some light thinking required',
  low: 'minimal cognitive load, react-only, comfortable and easy to play',
};

const TIME_DESCRIPTIONS = {
  short: 'under 5 hours to complete, or a game played in short runs (roguelikes count)',
  medium: '5-15 hours total, a few evenings',
  long: '15+ hours, a deep commitment',
};

function describeHistory(game: HistoryGame) {
  if (game.status === 'dropped') return `you dropped "${game.name}"`;
  return `you finished "${game.name}"${game.rating != null ? ` (${game.rating}/10)` : ''}`;
}

// Games scoring within this much of the best are flagged as top matches.
const TOP_MATCH_MARGIN = 1.5;

function formatCandidate(
  {
    game,
    score,
    series,
    similarTo,
    similarToDropped,
    recentlySkipped,
    outsideTimeRange,
  }: ScoredCandidate<GameForSuggestion>,
  bestScore: number,
): string {
  const hoursPlayed = Math.round((game.playtime_forever ?? 0) / 60);
  const parts = [
    `"${game.name}" (ID: ${game.app_id})`,
    score >= bestScore - TOP_MATCH_MARGIN ? 'TOP MATCH' : null,
    game.genres?.length ? `Genres: ${game.genres.join(', ')}` : null,
    game.tags?.length ? `Tags: ${game.tags.slice(0, 6).join(', ')}` : null,
    game.main_story_hours ? `Length: ${game.main_story_hours}h` : 'Length: unknown',
    hoursPlayed > 0 ? `Already played: ${hoursPlayed}h` : 'Never played',
    game.steam_review_score != null && game.steam_review_count
      ? `Steam reviews: ${game.steam_review_score}% positive of ${game.steam_review_count.toLocaleString('en-US')}`
      : null,
    series ? `Series: ${describeHistory(series)}` : null,
    similarTo.length
      ? `Plays like: ${similarTo.map((g) => describeHistory(g).replace('you finished ', '')).join(', ')}`
      : null,
    similarToDropped ? `Plays like a game you dropped: "${similarToDropped.name}"` : null,
    recentlySkipped ? 'Skipped recently' : null,
    outsideTimeRange ? 'Outside the time they asked for' : null,
  ].filter(Boolean);

  return parts.join(' | ');
}

function formatFinishedGames(games: FinishedGame[]): string {
  if (games.length === 0) return 'No finished games yet.';

  const loved = games.filter((g) => g.rating !== null && g.rating >= 8);
  const ok = games.filter((g) => g.rating !== null && g.rating >= 5 && g.rating < 8);
  const disliked = games.filter((g) => g.rating !== null && g.rating < 5);
  const unrated = games.filter((g) => g.rating === null);

  const lines: string[] = [];
  if (loved.length > 0)
    lines.push(`Loved (8-10/10): ${loved.map((g) => `${g.name} (${g.rating}/10)`).join(', ')}`);
  if (ok.length > 0)
    lines.push(`Liked (5-7/10): ${ok.map((g) => `${g.name} (${g.rating}/10)`).join(', ')}`);
  if (disliked.length > 0)
    lines.push(
      `Disliked (0-4/10): ${disliked.map((g) => `${g.name} (${g.rating}/10)`).join(', ')}`,
    );
  if (unrated.length > 0) lines.push(`No rating: ${unrated.map((g) => g.name).join(', ')}`);

  return lines.join('\n');
}

export function buildSuggestionPrompt(context: SuggestionContext): string {
  const { preferences, candidates, finishedGames, droppedGames, previousReasonings } = context;

  if (candidates.length === 0) {
    throw new Error('No eligible games to suggest');
  }
  const bestScore = Math.max(...candidates.map((c) => c.score));

  return `You are a game recommendation assistant helping a user pick their next game from their Steam backlog.

## WHAT THEY WANT RIGHT NOW

**Desired feeling:** ${MOOD_DESCRIPTIONS[preferences.mood]}
**Mental energy level:** ${ENERGY_DESCRIPTIONS[preferences.energy]}
**Time commitment:** ${TIME_DESCRIPTIONS[preferences.time]}

## SHORTLIST (${candidates.length} games from their backlog, in random order)

These have already been filtered to single-player games that fit the time they have, and scored against their mood and play history. Each line may say:
- "TOP MATCH": the strongest fits for their mood, energy and history.
- "Series": an earlier or related entry they played, with their rating.
- "Plays like": finished games it shares the most with, with their rating.
- "Plays like a game you dropped": a warning sign.

${candidates.map((c) => formatCandidate(c, bestScore)).join('\n')}

## THEIR HISTORY

**Finished** (their ratings are the strongest taste signal):
${formatFinishedGames(finishedGames)}

${droppedGames.length > 0 ? `**Dropped** (lost interest): ${droppedGames.join(', ')}` : 'No dropped games.'}

## YOUR TASK

Pick the ONE game from the shortlist that best fits right now, usually one marked TOP MATCH. In order of importance:
1. **Continuing a series they rated highly**: a game whose "Series" line shows a finished entry rated 8-10 is almost always the best pick, if it suits the mood at all.
2. **Mood and energy**: the game should deliver the feeling they asked for at the effort they have.
3. **Taste**: prefer games that play like ones they rated 8-10. Avoid ones that play like games they rated 0-4 or dropped.
4. **Started games**: some playtime means they were into it; a good pick if it fits.
5. Prefer games not marked "Skipped recently", and games inside their time range.

Only call a game a sequel, continuation or part of a series if its line has a "Series" field naming that game. Don't connect games from different series.

Write the reasoning in second person, speaking directly to them ("you", "your"). Mention a game from their history when it genuinely explains the pick (e.g. "Since you gave Trails of Cold Steel III a 9...").
${
  previousReasonings.length > 0
    ? `
AVOID REPETITION: They have rerolled. These were your previous explanations; don't reuse their reasoning or reference the same games from their history:
${previousReasonings.map((r, i) => `${i + 1}. ${JSON.stringify(r)}`).join('\n')}
`
    : ''
}
Respond with JSON: {"app_id": <the game's ID>, "reasoning": "<2-3 sentences on why this game fits your mood, energy and time right now>"}`;
}

export function parseAIResponse(response: string): { app_id: number; reasoning: string } {
  // Try to extract JSON from the response (handles markdown code blocks)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (typeof parsed.app_id !== 'number' || !Number.isInteger(parsed.app_id)) {
    throw new Error('Invalid app_id in AI response');
  }

  if (typeof parsed.reasoning !== 'string' || parsed.reasoning.length === 0) {
    throw new Error('Invalid reasoning in AI response');
  }

  return {
    app_id: parsed.app_id,
    reasoning: parsed.reasoning,
  };
}

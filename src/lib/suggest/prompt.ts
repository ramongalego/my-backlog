import type { SuggestionContext, GameForSuggestion, FinishedGame } from './types';

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
  short: '1-5 hours to complete OR games playable in short sessions (roguelikes count!)',
  medium: '5-12 hours total, perfect for a few evenings',
  long: '20+ hours, deep commitment, epic adventures',
};

function formatGameForPrompt(game: GameForSuggestion): string {
  const parts = [
    `"${game.name}" (ID: ${game.app_id})`,
    game.genres?.length ? `Genres: ${game.genres.join(', ')}` : null,
    game.tags?.length ? `Tags: ${game.tags.slice(0, 5).join(', ')}` : null,
    game.main_story_hours ? `Length: ${game.main_story_hours}h` : null,
    game.playtime_forever > 0
      ? `Already played: ${Math.round(game.playtime_forever / 60)}h`
      : 'Never played',
    game.steam_review_weighted ? `Rating: ${game.steam_review_weighted}%` : null,
    game.reroll_count > 0
      ? `(Skipped ${game.reroll_count} time${game.reroll_count > 1 ? 's' : ''} before)`
      : null,
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
  const {
    preferences,
    backlogGames,
    finishedGames,
    droppedGames,
    excludeAppIds,
    previousReasonings,
    tagAffinities,
  } = context;

  // Filter out excluded games
  const eligibleGames = backlogGames.filter((g) => !excludeAppIds.has(g.app_id));

  if (eligibleGames.length === 0) {
    throw new Error('No eligible games to suggest');
  }

  const gamesListFormatted = eligibleGames.map(formatGameForPrompt).join('\n');

  const prompt = `You are a game recommendation assistant helping a user pick their next game from their Steam backlog.

## USER'S CURRENT MOOD & PREFERENCES

**Desired feeling:** ${MOOD_DESCRIPTIONS[preferences.mood]}
**Mental energy level:** ${ENERGY_DESCRIPTIONS[preferences.energy]}
**Time commitment:** ${TIME_DESCRIPTIONS[preferences.time]}

## THEIR BACKLOG (${eligibleGames.length} eligible games)

${gamesListFormatted}

## USER'S GAMING HISTORY (Important - use this to personalize your recommendation!)

**Games they FINISHED** (user ratings are the strongest taste signal — prioritise accordingly):
${formatFinishedGames(finishedGames)}

${droppedGames.length > 0 ? `**Games they DROPPED** (lost interest - be cautious with similar styles/genres): ${droppedGames.slice(0, 10).join(', ')}${droppedGames.length > 10 ? ` and ${droppedGames.length - 10} more` : ''}` : 'No dropped games.'}

**Playtime patterns in backlog:** Look at the "Already played" values - games with some playtime mean they've tried it and might want to continue. Games with 0 playtime are completely fresh.
${
  tagAffinities.length > 0
    ? `
## USER'S TAG AFFINITIES (based on completion history)

These are the game tags this user tends to finish most consistently — a strong signal of genuine enjoyment:
${tagAffinities.map((t) => `- ${t.tag}: finished ${t.finished}/${t.total} games (${Math.round(t.completionRate * 100)}%)`).join('\n')}

Prioritize backlog games that share these tags when they also match the current mood/energy/time preferences.`
    : ''
}

## YOUR TASK

Pick ONE game from the backlog that best matches the current mood, energy, and time preferences. Consider:
- **User ratings are the strongest signal**: Ratings are on a 0–10 scale. Games rated 8–10 reveal exactly what they enjoy — look for backlog games with similar tags, genres, or themes. Games rated 0–4 reveal what they don't enjoy — avoid recommending similar styles even if they technically match the mood filter.
- **Sequels and series come first**: If the user has finished and rated entries in a series (e.g. "X II", "X III"), and the next entry (e.g. "X IV") is in their backlog, that is almost certainly the best recommendation — prioritise it strongly. Same applies to spin-offs or games by the same developer in the same sub-genre.
- **Completion without a rating** still signals they liked it enough to finish, but treat it as a weaker signal than an explicit rating.
- **Dropped games**: be cautious with games that share styles or themes with dropped titles.
- **Playtime signals interest**: games they've already started might be good to continue — especially if it's a sequel to something they loved.
- Games that were skipped/rerolled before should generally be deprioritised (but not excluded).
- Match the time commitment (roguelikes work for "short" sessions even if total playtime is long).
- Match the mood/genre appropriately.
- **Prefer single-player games or games with a substantial single-player campaign**. Only suggest a multiplayer-focused game if it clearly has a strong solo experience.

IMPORTANT: Write the reasoning in second person, speaking directly to the user (use "you/your", not "the user/their"). Reference their history when relevant (e.g., "Since you finished X, you might enjoy this similar game...").
${
  previousReasonings.length > 0
    ? `
AVOID REPETITION: The user has rerolled. Here are your previous suggestions - do NOT repeat the same reasoning patterns or reference the same games from their history:
${previousReasonings.map((r, i) => `${i + 1}. "${r}"`).join('\n')}

Use DIFFERENT examples from their history and vary your reasoning style.`
    : ''
}

Respond with ONLY valid JSON in this exact format:
{
  "app_id": <number>,
  "reasoning": "<2-3 sentences explaining why this game fits YOUR current mood, energy level, and time. Speak directly to the user.>"
}`;

  return prompt;
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

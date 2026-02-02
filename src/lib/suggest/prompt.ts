import type { SuggestionContext, GameForSuggestion } from './types';

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
    game.main_story_hours ? `Length: ${game.main_story_hours}h` : null,
    game.playtime_forever > 0 ? `Already played: ${Math.round(game.playtime_forever / 60)}h` : 'Never played',
    game.steam_review_weighted ? `Rating: ${game.steam_review_weighted}%` : null,
    game.reroll_count > 0 ? `(Skipped ${game.reroll_count} time${game.reroll_count > 1 ? 's' : ''} before)` : null,
  ].filter(Boolean);

  return parts.join(' | ');
}

export function buildSuggestionPrompt(context: SuggestionContext): string {
  const { preferences, backlogGames, finishedGames, droppedGames, excludeAppIds, previousReasonings } = context;

  // Filter out excluded games
  const eligibleGames = backlogGames.filter(g => !excludeAppIds.includes(g.app_id));

  if (eligibleGames.length === 0) {
    throw new Error('No eligible games to suggest');
  }

  const gamesListFormatted = eligibleGames
    .map(formatGameForPrompt)
    .join('\n');

  const prompt = `You are a game recommendation assistant helping a user pick their next game from their Steam backlog.

## USER'S CURRENT MOOD & PREFERENCES

**Desired feeling:** ${MOOD_DESCRIPTIONS[preferences.mood]}
**Mental energy level:** ${ENERGY_DESCRIPTIONS[preferences.energy]}
**Time commitment:** ${TIME_DESCRIPTIONS[preferences.time]}

## THEIR BACKLOG (${eligibleGames.length} eligible games)

${gamesListFormatted}

## USER'S GAMING HISTORY (Important - use this to personalize your recommendation!)

${finishedGames.length > 0 ? `**Games they FINISHED** (they loved these enough to complete - similar games are likely safe picks): ${finishedGames.slice(0, 10).join(', ')}${finishedGames.length > 10 ? ` and ${finishedGames.length - 10} more` : ''}` : 'No finished games yet.'}

${droppedGames.length > 0 ? `**Games they DROPPED** (lost interest - be cautious with similar styles/genres): ${droppedGames.slice(0, 10).join(', ')}${droppedGames.length > 10 ? ` and ${droppedGames.length - 10} more` : ''}` : 'No dropped games.'}

**Playtime patterns in backlog:** Look at the "Already played" values - games with some playtime mean they've tried it and might want to continue. Games with 0 playtime are completely fresh.

## YOUR TASK

Pick ONE game from the backlog that best matches the current mood, energy, and time preferences. Consider:
- **Their history matters**: If they finished similar games before, that's a strong signal. If they dropped similar games, be cautious.
- **Playtime signals interest**: Games they've already started playing might be good to continue. Fresh games (0 playtime) are also great for new experiences.
- Games that were skipped/rerolled before should generally be deprioritized (but not excluded)
- Higher-rated games are generally safer picks
- Match the time commitment (roguelikes work for "short" sessions even if total playtime is long)
- Match the mood/genre appropriately

IMPORTANT: Write the reasoning in second person, speaking directly to the user (use "you/your", not "the user/their"). Reference their history when relevant (e.g., "Since you finished X, you might enjoy this similar game...").
${previousReasonings.length > 0 ? `
AVOID REPETITION: The user has rerolled. Here are your previous suggestions - do NOT repeat the same reasoning patterns or reference the same games from their history:
${previousReasonings.map((r, i) => `${i + 1}. "${r}"`).join('\n')}

Use DIFFERENT examples from their history and vary your reasoning style.` : ''}

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

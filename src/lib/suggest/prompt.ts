import type { HistoryGame, ScoredCandidate } from './shortlist';
import { criticScoreOf } from '@/lib/games/rating';
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
    `"${game.name}" (ID: ${game.id})`,
    score >= bestScore - TOP_MATCH_MARGIN ? 'TOP MATCH' : null,
    game.genres?.length ? `Genres: ${game.genres.join(', ')}` : null,
    game.tags?.length ? `Tags: ${game.tags.slice(0, 6).join(', ')}` : null,
    game.main_story_hours ? `Length: ${game.main_story_hours}h` : 'Length: unknown',
    hoursPlayed > 0 ? `Already played: ${hoursPlayed}h` : 'Never played',
    criticScoreOf(game) != null
      ? `Critic score: ${criticScoreOf(game)} (from ${game.critic_count} reviews)`
      : null,
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

Don't pick a direct story sequel unless they finished the game it follows (its "Series" line shows a finished entry). From what you know of the game, a direct sequel continues the same story and cast, like Final Fantasy VII Rebirth after Remake, Final Fantasy X-2, Mass Effect 2 or Neptunia Re;Birth2. Entries that stand alone are fine to pick on their own: most Final Fantasy, Dragon Quest, Persona and Tales of games, and other series where each game is a new story.

${
  previousReasonings.length > 0
    ? `
AVOID REPETITION: They have rerolled. These were your previous explanations; don't reuse their reasoning or reference the same games from their history:
${previousReasonings.map((r, i) => `${i + 1}. ${JSON.stringify(r)}`).join('\n')}
`
    : ''
}
Write the reasoning following the style rules you were given.

Respond with JSON: {"game_id": <the game's ID>, "reasoning": "<the 2-3 sentences>"}`;
}

/**
 * How the reasoning is written, sent as the system message: the model follows
 * style rules there far more closely than at the end of a long brief, and
 * without them it writes ad copy ("a perfect pick", "a great choice").
 */
export const REASONING_STYLE = `You pick a game from someone's backlog and tell them why you picked it for them, in 2-3 short sentences. Talk to them ("you") like a friend who knows their library and has been waiting to hand them this one: warm, specific, with an opinion.

Open with why it's theirs tonight: what in it gives them the feeling they're after, and the thread to their own history when there is one (a series entry they rated, a game it plays like with their rating, hours they already put in). Then name one specific thing in it worth getting to: a character, a moment, a mechanic. Only what you're sure is true of the game, and no story spoilers. Say what they want in your own words, never the brief's ("focus-heavy", "story-first", "low pressure", "few evenings").

Don't describe the gameplay loop or list features: that's a store page, not a reason. Mention a game from their history only when it explains the pick, and always with their rating ("you gave it a 9"). Only say they've played the game if its line says "Already played".

Good: "You gave Pentiment a 9, and this is the same kind of story you steer with words, as a wrecked detective arguing with the voices in his own head. It's funny and sad in the same breath, and the first conversation with your necktie tells you exactly what you're in for."
Good: "You want somewhere easy to sink into, and this is a little island with nothing chasing you, where an evening goes on fishing and moving furniture around. Talk to everyone in town; they remember."
Bad: "You build a squad, manage their skills and gear, then take on missions where combat choices and conversations shape the story. It's a long commitment with plenty to learn."
Bad: "Since you enjoyed the series, this is a perfect pick. It offers a mix of action and exploration, making it a solid fit for your mood and a great choice for tonight."

The first bad one only says what you do in it, with no reason it's for them. The second is ad copy: hype words, vague genre labels, and their answers repeated back. Never use these words or phrases: perfect, excellent, ideal, great choice, solid fit, gem, experience, journey, adventure, immersive, cognitive load, itch, lane, vibe,"fits your mood", "for your energy level", "Since you", "look forward", "people remember". No em dashes, no exclamation marks.`;

export function parseAIResponse(response: string): { game_id: number; reasoning: string } {
  // Try to extract JSON from the response (handles markdown code blocks)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (typeof parsed.game_id !== 'number' || !Number.isInteger(parsed.game_id)) {
    throw new Error('Invalid game_id in AI response');
  }

  if (typeof parsed.reasoning !== 'string' || parsed.reasoning.length === 0) {
    throw new Error('Invalid reasoning in AI response');
  }

  return {
    game_id: parsed.game_id,
    reasoning: parsed.reasoning,
  };
}

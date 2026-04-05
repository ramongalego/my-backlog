import type { SteamGame, SteamPlayerSummary } from '@/lib/steam/api';

interface RoastStats {
  totalGames: number;
  totalHours: number;
  neverPlayed: number;
  unlaunchedPct: number;
  under1Hour: number;
  avgPlaytimeHours: number;
  refundSurvivors: number;
  topGameDominance: number;
  topGame: SteamGame | null;
  recentlyPlayed: SteamGame[];
  top10: SteamGame[];
  shameGames: SteamGame[];
  currentlyReplayingShame: SteamGame | null;
}

function computeStats(games: SteamGame[]): RoastStats {
  const totalGames = games.length;
  const totalMinutes = games.reduce((sum, g) => sum + g.playtime_forever, 0);
  const totalHours = Math.round(totalMinutes / 60);

  const neverPlayed = games.filter((g) => g.playtime_forever === 0).length;
  const unlaunchedPct = totalGames > 0 ? Math.round((neverPlayed / totalGames) * 100) : 0;

  const playedGames = games.filter((g) => g.playtime_forever > 0);
  const under1Hour = playedGames.filter((g) => g.playtime_forever < 60).length;
  const avgPlaytimeHours =
    playedGames.length > 0
      ? Math.round(
          (playedGames.reduce((sum, g) => sum + g.playtime_forever, 0) / playedGames.length / 60) *
            10,
        ) / 10
      : 0;

  const refundSurvivors = games.filter(
    (g) => g.playtime_forever >= 90 && g.playtime_forever <= 120,
  ).length;

  const sorted = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever);
  const topGame = sorted[0] ?? null;
  const top10 = sorted.slice(0, 10);
  const topGameDominance =
    totalHours > 0 && topGame ? Math.round((topGame.playtime_forever / totalMinutes) * 100) : 0;

  // "Shame games" — bought, launched once for < 15 min, never touched again
  const allShameGames = games.filter(
    (g) => g.playtime_forever > 0 && g.playtime_forever <= 15 && !g.playtime_2weeks,
  );

  const recentlyPlayed = games
    .filter((g) => g.playtime_2weeks && g.playtime_2weeks > 0)
    .sort((a, b) => (b.playtime_2weeks ?? 0) - (a.playtime_2weeks ?? 0))
    .slice(0, 5);

  const recentAppIds = new Set(recentlyPlayed.map((g) => g.appid));
  const currentlyReplayingShame = allShameGames.find((g) => recentAppIds.has(g.appid)) ?? null;

  const shameGames = allShameGames.slice(0, 5);

  return {
    totalGames,
    totalHours,
    neverPlayed,
    unlaunchedPct,
    under1Hour,
    avgPlaytimeHours,
    refundSurvivors,
    topGameDominance,
    topGame,
    recentlyPlayed,
    top10,
    shameGames,
    currentlyReplayingShame,
  };
}

function formatGame(g: SteamGame): string {
  const hours = Math.round(g.playtime_forever / 60);
  const mins = g.playtime_forever % 60;
  const time =
    g.playtime_forever < 60
      ? `${g.playtime_forever}min`
      : `${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
  return `${g.name} (${time})`;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface ProfileExtras {
  bans: {
    VACBanned: boolean;
    NumberOfVACBans: number;
    DaysSinceLastBan: number;
    NumberOfGameBans: number;
  } | null;
  steamLevel: number | null;
  wishlistCount: number | null;
}

export function buildRoastPrompt(
  profile: SteamPlayerSummary,
  games: SteamGame[],
  topTags?: TagCount[],
  extras?: ProfileExtras,
): string {
  const stats = computeStats(games);

  // Build a flat data dump — let the model decide what's funny
  const data: Record<string, unknown> = {
    username: profile.personaname,
    totalGames: stats.totalGames,
    totalHours: stats.totalHours,
    neverLaunched: `${stats.neverPlayed} (${stats.unlaunchedPct}%)`,
    under1Hour: stats.under1Hour,
    avgPlaytimeHours: stats.avgPlaytimeHours,
    refundWindowSurvivors: stats.refundSurvivors,
    topGameDominance: `${stats.topGameDominance}%`,
    mostPlayed: stats.top10.map((g) => formatGame(g)),
  };

  if (topTags && topTags.length > 0) {
    data.topTags = topTags.map((t) => `${t.tag} (${t.count}/10)`);
  }

  if (stats.recentlyPlayed.length > 0) {
    data.recentlyPlayed = stats.recentlyPlayed.map((g) => {
      const hrs = Math.round((g.playtime_2weeks ?? 0) / 60);
      return `${g.name} (${hrs}h last 2 weeks)`;
    });
  }

  if (stats.shameGames.length > 0) {
    data.abandoned = stats.shameGames.map((g) => formatGame(g));
  }

  if (stats.currentlyReplayingShame) {
    data.currentlyReplayingAbandonedGame = stats.currentlyReplayingShame.name;
  }

  if (extras?.steamLevel != null) data.steamLevel = extras.steamLevel;
  if (extras?.wishlistCount != null) data.wishlistSize = extras.wishlistCount;
  if (extras?.bans) {
    if (extras.bans.VACBanned) {
      data.vacBans = `${extras.bans.NumberOfVACBans} VAC ban(s), last ${extras.bans.DaysSinceLastBan} days ago`;
    }
    if (extras.bans.NumberOfGameBans > 0) {
      data.gameBans = extras.bans.NumberOfGameBans;
    }
  }

  const lines: string[] = [
    `You roast people's Steam gaming profiles as harsh and spicy as possible.`,
    `Roast this Steam user in 3–4 short paragraphs. Each paragraph should be 2–3 sentences max — punchy, not rambling.`,
    `Tone: sharp, personal, and condescending. Talk directly to them. Each paragraph should land one clear joke or observation, then move on. Think mean tweet energy, not essay.`,
    `Reference specific games by name, call out specific numbers (hours, percentages), and make it sting. The user WANTS to be destroyed.`,
    `End with a final paragraph that sounds like a compliment but is actually one last insult.`,
    `Do NOT use markdown, headers, or bullet points. Just plain short paragraphs.`,
    ``,
    `Give a harsh roasting for the following Steam profile: ${profile.personaname}. Here are the details: "${JSON.stringify(data)}"`,
  ];

  return lines.join('\n');
}

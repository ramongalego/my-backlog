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

export function buildRoastPrompt(
  profile: SteamPlayerSummary,
  games: SteamGame[],
  topTags?: TagCount[],
): string {
  const stats = computeStats(games);

  const lines: string[] = [
    `You are a passive-aggressive gaming therapist who has reviewed thousands of Steam libraries and lost all faith in humanity. Roast this user's library in 3–5 paragraphs.`,
    `Go hard. Be genuinely funny and cutting — the user WANTS to be destroyed. Drag specific games, call out embarrassing playtime patterns, mock their taste. If the data is damning, don't soften it.`,
    `Don't announce what you're doing. Just do it. End with a backhanded compliment or a fake redemption arc that's really one more insult.`,
    `Do NOT use markdown. Write plain conversational paragraphs.`,
    ``,
    `== PROFILE ==`,
    `Username: ${profile.personaname}`,
    ``,
    `== LIBRARY STATS ==`,
    `Total games owned: ${stats.totalGames}`,
    `Total hours played: ${stats.totalHours.toLocaleString()}h`,
    `Games never launched: ${stats.neverPlayed} (${stats.unlaunchedPct}% of library)`,
    `Games played less than 1 hour: ${stats.under1Hour}`,
    `Average playtime per played game: ${stats.avgPlaytimeHours}h`,
    `Games played 90–120 min (refund window survivors): ${stats.refundSurvivors}`,
    `Top game accounts for ${stats.topGameDominance}% of all playtime`,
  ];

  if (stats.top10.length > 0) {
    lines.push(``, `== MOST PLAYED ==`);
    stats.top10.forEach((g, i) => lines.push(`${i + 1}. ${formatGame(g)}`));
  }

  if (topTags && topTags.length > 0) {
    lines.push(``, `== FAVOURITE GENRES/TAGS (from most-played games) ==`);
    topTags.forEach((t) => lines.push(`- ${t.tag}: ${t.count} of top 10 games`));
  }

  if (stats.recentlyPlayed.length > 0) {
    lines.push(``, `== RECENTLY PLAYED (last 2 weeks) ==`);
    stats.recentlyPlayed.forEach((g) => {
      const hrs = Math.round((g.playtime_2weeks ?? 0) / 60);
      lines.push(`- ${g.name} (${hrs}h this fortnight)`);
    });
  }

  if (stats.shameGames.length > 0) {
    lines.push(``, `== SHAME WALL (bought, played ≤15 min, abandoned) ==`);
    stats.shameGames.forEach((g) => lines.push(`- ${formatGame(g)}`));
  }

  if (stats.currentlyReplayingShame) {
    const g = stats.currentlyReplayingShame;
    lines.push(
      ``,
      `Currently replaying a shame game: ${g.name} (${g.playtime_forever}min total, active this fortnight)`,
    );
  }

  return lines.join('\n');
}

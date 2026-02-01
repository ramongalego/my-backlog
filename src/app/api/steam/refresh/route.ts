import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedGames } from "@/lib/steam/api";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limiting - stricter for Steam refresh
  const ip = getClientIp(request);
  const rateLimitResult = checkRateLimit(`steam-refresh:${ip}`, RATE_LIMITS.steamRefresh);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's Steam ID from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("steam_id")
    .eq("id", user.id)
    .single();

  if (!profile?.steam_id) {
    return NextResponse.json({ error: "Steam not connected" }, { status: 400 });
  }

  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  try {
    // Fetch current Steam library
    const steamGames = await getOwnedGames(profile.steam_id, apiKey);

    // Get existing game app_ids from DB
    const { data: existingGames } = await supabase
      .from("games")
      .select("app_id")
      .eq("user_id", user.id);

    const existingAppIds = new Set(existingGames?.map(g => g.app_id) || []);

    // Find new games not in DB
    const newGames = steamGames.filter(game => !existingAppIds.has(game.appid));

    if (newGames.length === 0) {
      return NextResponse.json({ success: true, newGames: 0 });
    }

    // Insert new games
    const gamesToInsert = newGames.map((game) => ({
      user_id: user.id,
      app_id: game.appid,
      name: game.name,
      playtime_forever: game.playtime_forever,
      img_icon_url: game.img_icon_url,
    }));

    const { error } = await supabase.from("games").insert(gamesToInsert);

    if (error) {
      console.error("Error inserting new games:", error);
      return NextResponse.json({ error: "Failed to insert games" }, { status: 500 });
    }

    return NextResponse.json({ success: true, newGames: newGames.length });
  } catch (error) {
    console.error("Steam API error:", error);
    return NextResponse.json({ error: "Steam API failed" }, { status: 500 });
  }
}

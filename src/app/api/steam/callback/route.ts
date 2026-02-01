import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSteamRelyingParty, extractSteamId } from "@/lib/steam/auth";
import { getOwnedGames, getPlayerSummary } from "@/lib/steam/api";
import { timingSafeEqual } from "crypto";

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;
  const returnUrl = `${baseUrl}/api/steam/callback`;

  // Validate CSRF state
  const cookieState = request.cookies.get("steam_auth_state")?.value;
  const urlState = request.nextUrl.searchParams.get("state");

  if (!cookieState || !urlState || !constantTimeCompare(cookieState, urlState)) {
    const response = NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
    response.cookies.delete("steam_auth_state");
    return response;
  }

  const relyingParty = createSteamRelyingParty(returnUrl);

  return new Promise<NextResponse>((resolve) => {
    relyingParty.verifyAssertion(request.url, async (error, result) => {
      if (error || !result?.authenticated || !result.claimedIdentifier) {
        const response = NextResponse.redirect(`${baseUrl}/?error=steam_auth_failed`);
        response.cookies.delete("steam_auth_state");
        resolve(response);
        return;
      }

      const steamId = extractSteamId(result.claimedIdentifier);

      // Helper to create redirect with cleared state cookie
      const redirectWithClearedState = (url: string) => {
        const response = NextResponse.redirect(url);
        response.cookies.delete("steam_auth_state");
        return response;
      };

      if (!steamId) {
        console.error("Could not extract Steam ID");
        resolve(redirectWithClearedState(`${baseUrl}/?error=invalid_steam_id`));
        return;
      }

      const apiKey = process.env.STEAM_API_KEY;

      if (!apiKey) {
        console.error("STEAM_API_KEY not configured");
        resolve(redirectWithClearedState(`${baseUrl}/?error=server_config`));
        return;
      }

      // Get current user from Supabase
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error("No authenticated user found");
        resolve(redirectWithClearedState(`${baseUrl}/?error=not_authenticated`));
        return;
      }

      try {
        const [playerSummary, games] = await Promise.all([
          getPlayerSummary(steamId, apiKey),
          getOwnedGames(steamId, apiKey),
        ]);

        // Update profile with Steam data
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            steam_id: steamId,
            steam_username: playerSummary?.personaname || null,
            steam_avatar: playerSummary?.avatarfull || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (profileError) {
          console.error("Profile update failed");
          resolve(redirectWithClearedState(`${baseUrl}/?error=profile_update_failed`));
          return;
        }

        // Delete existing games and insert fresh data
        await supabase.from("games").delete().eq("user_id", user.id);

        if (games.length > 0) {
          const gamesToInsert = games.map((game) => ({
            user_id: user.id,
            app_id: game.appid,
            name: game.name,
            playtime_forever: game.playtime_forever,
            img_icon_url: game.img_icon_url,
          }));

          // Insert in batches of 500 (Supabase limit)
          const batchSize = 500;
          for (let i = 0; i < gamesToInsert.length; i += batchSize) {
            const batch = gamesToInsert.slice(i, i + batchSize);
            const { error: gamesError } = await supabase.from("games").insert(batch);

            if (gamesError) {
              console.error("Games batch insert failed");
            }
          }
        }

        resolve(redirectWithClearedState(baseUrl));
      } catch {
        console.error("Steam API request failed");
        resolve(redirectWithClearedState(`${baseUrl}/?error=steam_api_failed`));
      }
    });
  });
}

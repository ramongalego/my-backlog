import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSteamRelyingParty, extractSteamId } from "@/lib/steam/auth";
import { getOwnedGames, getPlayerSummary } from "@/lib/steam/api";

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;
  const returnUrl = `${baseUrl}/api/steam/callback`;

  const relyingParty = createSteamRelyingParty(returnUrl);

  return new Promise<NextResponse>((resolve) => {
    relyingParty.verifyAssertion(request.url, async (error, result) => {
      if (error || !result?.authenticated || !result.claimedIdentifier) {
        console.error("Steam auth verification failed:", error);
        resolve(NextResponse.redirect(`${baseUrl}/?error=steam_auth_failed`));
        return;
      }

      const steamId = extractSteamId(result.claimedIdentifier);

      if (!steamId) {
        console.error("Could not extract Steam ID from:", result.claimedIdentifier);
        resolve(NextResponse.redirect(`${baseUrl}/?error=invalid_steam_id`));
        return;
      }

      const apiKey = process.env.STEAM_API_KEY;

      if (!apiKey) {
        console.error("STEAM_API_KEY not configured");
        resolve(NextResponse.redirect(`${baseUrl}/?error=server_config`));
        return;
      }

      // Get current user from Supabase
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error("No authenticated user found");
        resolve(NextResponse.redirect(`${baseUrl}/?error=not_authenticated`));
        return;
      }

      try {
        const [playerSummary, games] = await Promise.all([
          getPlayerSummary(steamId, apiKey),
          getOwnedGames(steamId, apiKey),
        ]);

        if (process.env.NODE_ENV === "development") {
          console.log("=== STEAM CONNECTION SUCCESSFUL ===");
          console.log("Player:", playerSummary?.personaname);
          console.log("Total games:", games.length);
        }

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
          console.error("Error updating profile:", profileError);
          resolve(NextResponse.redirect(`${baseUrl}/?error=profile_update_failed`));
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
              console.error("Error inserting games batch:", gamesError);
            }
          }
        }

        if (process.env.NODE_ENV === "development") {
          console.log("Steam data saved successfully");
        }
        resolve(NextResponse.redirect(baseUrl));
      } catch (apiError) {
        console.error("Steam API error:", apiError);
        resolve(NextResponse.redirect(`${baseUrl}/?error=steam_api_failed`));
      }
    });
  });
}

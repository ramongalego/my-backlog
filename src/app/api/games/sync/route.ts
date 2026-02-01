import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGameDetails, extractGameMetadata, getSteamReviewData } from "@/lib/steam/store-api";
import { getMainStoryHours } from "@/lib/hltb/api";
import { isMetadataFresh, calculateBayesianScore } from "@/lib/games/scoring";

interface GameMetadata {
  app_id: number;
  type: string | null;
  name: string | null;
  genres: string[] | null;
  categories: string[] | null;
  description: string | null;
  release_date: string | null;
  header_image: string | null;
  steam_review_score: number | null;
  steam_review_count: number | null;
  steam_review_weighted: number | null;
  main_story_hours: number | null;
  synced_at: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { appId } = body;

  if (!appId || typeof appId !== "number" || !Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: "Invalid appId" }, { status: 400 });
  }

  // Check for existing fresh metadata in shared table
  const { data: existingMetadata } = await supabase
    .from("game_metadata")
    .select("*")
    .eq("app_id", appId)
    .single();

  let metadata: GameMetadata | null = null;
  let fromCache = false;

  if (existingMetadata && isMetadataFresh(existingMetadata.synced_at)) {
    // Use cached metadata
    metadata = existingMetadata as GameMetadata;
    fromCache = true;
  } else {
    // Fetch from APIs
    const details = await getGameDetails(appId);
    const extractedMetadata = details ? extractGameMetadata(details) : null;

    if (extractedMetadata) {
      const isGame = extractedMetadata.type === 'game';

      // Only fetch HLTB and Steam reviews for actual games
      const [mainStoryHours, steamReviewData] = isGame
        ? await Promise.all([
            details?.data?.name ? getMainStoryHours(details.data.name) : null,
            getSteamReviewData(appId),
          ])
        : [null, null];

      // Calculate weighted score using Bayesian average
      const weightedScore = steamReviewData
        ? calculateBayesianScore(steamReviewData.score, steamReviewData.count)
        : null;

      metadata = {
        app_id: appId,
        type: extractedMetadata.type,
        name: details?.data?.name ?? null,
        genres: extractedMetadata.genres,
        categories: extractedMetadata.categories,
        description: extractedMetadata.description,
        release_date: extractedMetadata.release_date,
        header_image: extractedMetadata.header_image,
        steam_review_score: steamReviewData?.score ?? null,
        steam_review_count: steamReviewData?.count ?? null,
        steam_review_weighted: weightedScore,
        main_story_hours: mainStoryHours,
        synced_at: new Date().toISOString(),
      };

      // Upsert into shared game_metadata table
      await supabase
        .from("game_metadata")
        .upsert(metadata, { onConflict: "app_id" });
    }
  }

  if (metadata) {
    // Update user's game with metadata from shared table
    await supabase
      .from("games")
      .update({
        type: metadata.type,
        genres: metadata.genres,
        categories: metadata.categories,
        description: metadata.description,
        release_date: metadata.release_date,
        steam_review_score: metadata.steam_review_score,
        steam_review_count: metadata.steam_review_count,
        steam_review_weighted: metadata.steam_review_weighted,
        header_image: metadata.header_image,
        main_story_hours: metadata.main_story_hours,
        metadata_synced: true,
      })
      .eq("user_id", user.id)
      .eq("app_id", appId);

    return NextResponse.json({
      success: true,
      fromCache,
      metadata: {
        type: metadata.type,
        genres: metadata.genres,
        categories: metadata.categories,
        description: metadata.description,
        release_date: metadata.release_date,
        header_image: metadata.header_image,
        main_story_hours: metadata.main_story_hours,
        steam_review_score: metadata.steam_review_score,
        steam_review_count: metadata.steam_review_count,
        steam_review_weighted: metadata.steam_review_weighted,
      }
    });
  } else {
    // Mark as synced even if no data (game might be removed from store)
    await supabase
      .from("games")
      .update({ metadata_synced: true })
      .eq("user_id", user.id)
      .eq("app_id", appId);

    return NextResponse.json({ success: true, fromCache: false, metadata: null });
  }
}

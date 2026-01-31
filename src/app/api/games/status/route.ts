import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appId, status } = await request.json();

  if (!appId || !status) {
    return NextResponse.json({ error: "Missing appId or status" }, { status: 400 });
  }

  const validStatuses = ['backlog', 'playing', 'finished', 'dropped', 'hidden'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // If setting to "playing", first clear any other "playing" games
  if (status === 'playing') {
    await supabase
      .from("games")
      .update({ status: 'backlog' })
      .eq("user_id", user.id)
      .eq("status", 'playing');
  }

  // Update the game status
  const { error } = await supabase
    .from("games")
    .update({ status })
    .eq("user_id", user.id)
    .eq("app_id", appId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get currently playing game
  const { data } = await supabase
    .from("games")
    .select("app_id, name, header_image, main_story_hours")
    .eq("user_id", user.id)
    .eq("status", "playing")
    .single();

  return NextResponse.json({ game: data });
}

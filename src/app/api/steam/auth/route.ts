import { NextRequest, NextResponse } from "next/server";
import { createSteamRelyingParty, getSteamAuthUrl } from "@/lib/steam/auth";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;
  const returnUrl = `${baseUrl}/api/steam/callback`;

  // Generate CSRF state token
  const state = randomBytes(32).toString("hex");

  const relyingParty = createSteamRelyingParty(returnUrl);

  return new Promise<NextResponse>((resolve) => {
    relyingParty.authenticate(getSteamAuthUrl(), false, (error, authUrl) => {
      if (error || !authUrl) {
        resolve(
          NextResponse.json(
            { error: "Failed to create Steam auth URL" },
            { status: 500 }
          )
        );
        return;
      }

      // Append state to the auth URL
      const urlWithState = new URL(authUrl);
      urlWithState.searchParams.set("state", state);

      const response = NextResponse.redirect(urlWithState.toString());

      // Set state in HTTP-only cookie (5 minute TTL)
      response.cookies.set("steam_auth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 300, // 5 minutes
        path: "/",
      });

      resolve(response);
    });
  });
}

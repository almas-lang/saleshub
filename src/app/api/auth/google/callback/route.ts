import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/google/auth";

/**
 * Google OAuth2 callback handler.
 * Google redirects here after the user grants calendar access.
 * The team member ID is passed via the state parameter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // team_member_id
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Determine redirect target — connect page if from admin flow
  const redirectBase = `${appUrl}/settings/integrations`;

  // User denied access
  if (error) {
    return NextResponse.redirect(
      `${redirectBase}/connect?error=google_denied`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${redirectBase}/connect?error=missing_params`
    );
  }

  const result = await handleCallback(code, state);

  if (!result.success) {
    return NextResponse.redirect(
      `${redirectBase}/connect?error=google_failed`
    );
  }

  return NextResponse.redirect(
    `${redirectBase}/connect?google=connected`
  );
}

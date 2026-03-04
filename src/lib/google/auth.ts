/**
 * Google OAuth2 token management
 * Reference: ARCHITECTURE.md Section 7.4, PHASE2_SETUP.md Step 4
 *
 * Handles OAuth2 flow for connecting Google Calendar per team member.
 * Tokens are stored in the team_members table.
 */

import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

// ── Types ──────────────────────────────────────────

export interface GoogleAuthResult {
  success: boolean;
  error?: string;
}

// ── Helpers ─────────────────────────────────────────

/** Create a fresh OAuth2 client */
export function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/**
 * Create an authenticated OAuth2 client for a specific team member.
 * Automatically refreshes the token if expired.
 */
export async function getAuthenticatedClient(teamMemberId: string) {
  const { data: member, error } = await supabaseAdmin
    .from("team_members")
    .select(
      "google_access_token, google_refresh_token, google_token_expires_at"
    )
    .eq("id", teamMemberId)
    .single();

  if (error || !member?.google_refresh_token) {
    return null;
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: member.google_access_token,
    refresh_token: member.google_refresh_token,
    expiry_date: member.google_token_expires_at
      ? new Date(member.google_token_expires_at).getTime()
      : undefined,
  });

  // Check if token is expired or about to expire (5 min buffer)
  const expiresAt = member.google_token_expires_at
    ? new Date(member.google_token_expires_at).getTime()
    : 0;
  const isExpired = Date.now() > expiresAt - 5 * 60 * 1000;

  if (isExpired) {
    const refreshed = await refreshToken(teamMemberId, oauth2Client);
    if (!refreshed.success) return null;
  }

  return oauth2Client;
}

// ── Public API ──────────────────────────────────────

/**
 * Generate the Google OAuth consent URL.
 * The state parameter carries the team member ID for the callback.
 */
export function getAuthUrl(teamMemberId: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: teamMemberId,
  });
}

/**
 * Exchange the authorization code for tokens and save to team_members.
 */
export async function handleCallback(
  code: string,
  teamMemberId: string
): Promise<GoogleAuthResult> {
  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    const { error } = await supabaseAdmin
      .from("team_members")
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expires_at: expiresAt,
        google_calendar_connected: true,
      })
      .eq("id", teamMemberId);

    if (error) {
      console.error("[Google Auth] save tokens error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Auth] callback error:", message);
    return { success: false, error: message };
  }
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshToken(
  teamMemberId: string,
  existingClient?: InstanceType<typeof google.auth.OAuth2>
): Promise<GoogleAuthResult> {
  try {
    let oauth2Client = existingClient;

    if (!oauth2Client) {
      const { data: member } = await supabaseAdmin
        .from("team_members")
        .select("google_refresh_token")
        .eq("id", teamMemberId)
        .single();

      if (!member?.google_refresh_token) {
        return { success: false, error: "No refresh token found" };
      }

      oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials({
        refresh_token: member.google_refresh_token,
      });
    }

    const { credentials } = await oauth2Client.refreshAccessToken();

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : null;

    const { error } = await supabaseAdmin
      .from("team_members")
      .update({
        google_access_token: credentials.access_token,
        google_token_expires_at: expiresAt,
      })
      .eq("id", teamMemberId);

    if (error) {
      console.error("[Google Auth] save refreshed token error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Auth] refresh error:", message);
    return { success: false, error: message };
  }
}

/**
 * Disconnect Google Calendar for a team member.
 * Revokes the token and clears stored credentials.
 */
export async function disconnect(
  teamMemberId: string
): Promise<GoogleAuthResult> {
  try {
    const { data: member } = await supabaseAdmin
      .from("team_members")
      .select("google_access_token")
      .eq("id", teamMemberId)
      .single();

    // Revoke the token with Google
    if (member?.google_access_token) {
      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials({
        access_token: member.google_access_token,
      });
      await oauth2Client.revokeCredentials().catch(() => {
        // Ignore revoke errors — token may already be invalid
      });
    }

    const { error } = await supabaseAdmin
      .from("team_members")
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null,
        google_calendar_connected: false,
      })
      .eq("id", teamMemberId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Auth] disconnect error:", message);
    return { success: false, error: message };
  }
}

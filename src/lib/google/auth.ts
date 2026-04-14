/**
 * Google OAuth2 token management
 * Reference: ARCHITECTURE.md Section 7.4, PHASE2_SETUP.md Step 4
 *
 * Handles OAuth2 flow for connecting Google Calendar per team member.
 * Tokens are stored in the team_members table.
 *
 * Uses google-auth-library (lightweight) instead of full googleapis SDK.
 */

import { OAuth2Client } from "google-auth-library";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { logger } from "@/lib/logger";

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

/**
 * Mark a team member as disconnected and notify admins by email.
 * Only sends email on the *transition* from connected → disconnected,
 * so failed retries don't spam.
 */
async function markDisconnectedAndNotify(teamMemberId: string, reason: string) {
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("name, email, google_calendar_connected")
    .eq("id", teamMemberId)
    .single();

  if (!member?.google_calendar_connected) return;

  await supabaseAdmin
    .from("team_members")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      google_calendar_connected: false,
      google_disconnect_reason: reason,
      google_disconnected_at: new Date().toISOString(),
    } as any)
    .eq("id", teamMemberId);

  await logger.error("google-auth", `Calendar disconnected for ${member.email}`, {
    teamMemberId,
    email: member.email,
    name: member.name,
    reason,
  });

  try {
    const { data: admins } = await supabaseAdmin
      .from("team_members")
      .select("email")
      .eq("role", "admin")
      .eq("is_active", true);

    const recipients = Array.from(
      new Set([
        ...((admins ?? []).map((a) => a.email).filter(Boolean) as string[]),
        member.email,
      ].filter(Boolean) as string[])
    );

    if (recipients.length === 0) return;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.xperiencewave.com";
    const connectUrl = `${appUrl}/settings/integrations/connect`;

    await sendEmail({
      to: recipients,
      subject: `⚠️ Google Calendar disconnected for ${member.name ?? member.email}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;">
          <h2 style="color:#b91c1c;margin:0 0 12px;">Calendar disconnected</h2>
          <p>Google Calendar for <strong>${member.name ?? member.email}</strong> (${member.email}) was just disconnected.</p>
          <p style="color:#555;">Reason: ${reason}</p>
          <p><strong>Bookings will not show available time slots until this is reconnected.</strong></p>
          <p style="margin:24px 0;">
            <a href="${connectUrl}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Reconnect now</a>
          </p>
          <p style="color:#888;font-size:12px;">SalesHub auto-notification</p>
        </div>
      `,
      tags: [{ name: "type", value: "calendar_disconnect" }],
    });
  } catch (err) {
    console.error("[Google Auth] notify email failed:", err);
  }
}

/** Create a fresh OAuth2 client */
export function createOAuth2Client() {
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
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
    if (!refreshed.success) {
      await markDisconnectedAndNotify(
        teamMemberId,
        refreshed.error ?? "Token refresh failed"
      );
      console.error(
        `[Google Auth] Token refresh failed for ${teamMemberId}, marking disconnected`
      );
      return null;
    }
  }

  return oauth2Client;
}

/**
 * Get a valid access token string for direct REST API calls.
 */
export async function getAccessToken(
  teamMemberId: string
): Promise<string | null> {
  const client = await getAuthenticatedClient(teamMemberId);
  if (!client) return null;
  const tokenRes = await client.getAccessToken();
  return tokenRes.token ?? null;
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
  existingClient?: OAuth2Client
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

    // Save new access token + refresh token if Google rotated it
    const updatePayload: Record<string, unknown> = {
      google_access_token: credentials.access_token,
      google_token_expires_at: expiresAt,
    };
    if (credentials.refresh_token) {
      updatePayload.google_refresh_token = credentials.refresh_token;
    }

    const { error } = await supabaseAdmin
      .from("team_members")
      .update(updatePayload)
      .eq("id", teamMemberId);

    if (error) {
      console.error("[Google Auth] save refreshed token error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Auth] refresh error:", message);
    try {
      await markDisconnectedAndNotify(teamMemberId, message);
    } catch {
      // Ignore notify errors during error handling
    }
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

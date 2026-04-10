import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

/**
 * Lightweight endpoint for updating an existing contact's metadata.
 * Used by the congratulations page to add portfolio/resume URLs
 * without resending name and all lead-capture fields.
 *
 * POST /api/webhooks/lead-capture/update?key=<secret>
 * Body: { email, portfolio_url?, resume_url? }
 */

const updateSchema = z.object({
  email: z.string().email(),
  portfolio_url: z.string().optional(),
  resume_url: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // ── Verify secret ──────────────────────────
  const secret = process.env.SALESHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const headerSecret = request.headers.get("x-webhook-secret");
  const querySecret = request.nextUrl.searchParams.get("key");

  if (headerSecret !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────
  let rawBody: Record<string, unknown>;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    rawBody = Object.fromEntries(formData.entries());
  } else {
    rawBody = await request.json();
  }

  const parsed = updateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email, portfolio_url, resume_url } = parsed.data;

  if (!portfolio_url && !resume_url) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // ── Find contact ───────────────────────────
  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id, metadata")
    .eq("email", email.toLowerCase().trim())
    .is("deleted_at", null)
    .maybeSingle();

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  // ── Merge into metadata ────────────────────
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const prevMeta = (contact.metadata as Record<string, any>) ?? {};
  const newMeta = { ...prevMeta } as Record<string, any>;
  if (portfolio_url) newMeta.portfolio_url = portfolio_url;
  if (resume_url) newMeta.resume_url = resume_url;

  await supabaseAdmin
    .from("contacts")
    .update({ metadata: newMeta as any })
    .eq("id", contact.id);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return NextResponse.json({ success: true, contact_id: contact.id });
}

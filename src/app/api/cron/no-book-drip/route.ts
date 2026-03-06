import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { renderNoBookNudgeEmail } from "@/lib/email/templates/no-book-nudge";
import { renderNoBook24hEmail } from "@/lib/email/templates/no-book-24h";
import { renderNoBook48hEmail } from "@/lib/email/templates/no-book-48h";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Drip thresholds (in milliseconds) ─────────────
const MIN_40 = 40 * 60 * 1000;
const HOUR_24 = 24 * 60 * 60 * 1000;
const HOUR_48 = 48 * 60 * 60 * 1000;
const DAY_3 = 3 * 24 * 60 * 60 * 1000;

type TemplateKey = "no-book-nudge" | "no-book-24h" | "no-book-48h";

export async function GET(request: Request) {
  // ── Auth (header or query param) ─────────────────
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  const isAuthed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const threeDaysAgo = new Date(now - DAY_3).toISOString();

    // ── Query contacts who signed up from landing page, haven't booked ──
    const { data: contacts, error } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, email, created_at")
      .eq("source", "landing_page")
      .is("deleted_at", null)
      .gte("created_at", threeDaysAgo)
      .not("email", "is", null);

    if (error) {
      console.error("[No-Book Drip] Query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!contacts?.length) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    // Filter out contacts who have booked (metadata->call_booked is set)
    const { data: bookedContacts } = await supabaseAdmin
      .from("contacts")
      .select("id, metadata")
      .in(
        "id",
        contacts.map((c) => c.id)
      );

    const bookedIds = new Set(
      (bookedContacts ?? [])
        .filter((c) => {
          const meta = c.metadata as Record<string, unknown> | null;
          return meta?.call_booked != null;
        })
        .map((c) => c.id)
    );

    const unbookedContacts = contacts.filter((c) => !bookedIds.has(c.id));

    let emailsSent = 0;

    for (const contact of unbookedContacts) {
      const elapsed = now - new Date(contact.created_at).getTime();

      // Determine which template to send
      let templateKey: TemplateKey | null = null;
      if (elapsed >= HOUR_48) {
        templateKey = "no-book-48h";
      } else if (elapsed >= HOUR_24) {
        templateKey = "no-book-24h";
      } else if (elapsed >= MIN_40) {
        templateKey = "no-book-nudge";
      }

      const contactEmail = contact.email;
      if (!templateKey || !contactEmail) continue;

      // Check if this template was already sent
      const { count } = await supabaseAdmin
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contact.id)
        .eq("type", "email_sent")
        .eq("metadata->>template", templateKey);

      if ((count ?? 0) > 0) continue;

      // Render + send
      const firstName = contact.first_name || "there";
      let rendered: { subject: string; html: string };

      if (templateKey === "no-book-nudge") {
        rendered = await renderNoBookNudgeEmail({ firstName });
      } else if (templateKey === "no-book-24h") {
        rendered = await renderNoBook24hEmail({ firstName });
      } else {
        rendered = await renderNoBook48hEmail({ firstName });
      }

      try {
        const result = await sendEmail({
          to: contactEmail,
          subject: rendered.subject,
          html: rendered.html,
        });

        if (result.success) {
          await supabaseAdmin.from("activities").insert({
            contact_id: contact.id,
            type: "email_sent",
            title: `No-book drip: ${templateKey}`,
            metadata: { template: templateKey },
          });
          emailsSent++;
        }
      } catch (err) {
        console.error(
          `[No-Book Drip] Failed for ${contactEmail}:`,
          err
        );
      }
    }

    return NextResponse.json({ success: true, processed: unbookedContacts.length, emailsSent });
  } catch (error) {
    console.error("[No-Book Drip] Cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

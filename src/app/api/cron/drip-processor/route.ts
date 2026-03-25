import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTemplate } from "@/lib/whatsapp/client";
import { sendEmail, renderVariables } from "@/lib/email/client";
import { renderDripEmail } from "@/lib/email/templates/drip-wrapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


const BATCH_LIMIT = 50;

interface Enrollment {
  id: string;
  contact_id: string;
  campaign_id: string;
  campaign_type: string;
  current_step_order: number;
  status: string;
  next_send_at: string;
}

interface WAStep {
  id: string;
  campaign_id: string;
  order: number;
  wa_template_name: string;
  wa_template_params: string[] | null;
  delay_hours: number;
  condition: { check: string; value?: string } | null;
}

interface EmailStepRow {
  id: string;
  campaign_id: string;
  order: number;
  subject: string;
  preview_text: string | null;
  body_html: string;
  delay_hours: number;
  condition: { check: string; value?: string } | null;
}

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
    const now = new Date().toISOString();

    // 1. Fetch due enrollments
    const { data: enrollments, error: enrollError } = await supabaseAdmin.from("drip_enrollments")
      .select("*")
      .eq("status", "active")
      .lte("next_send_at", now)
      .limit(BATCH_LIMIT);

    if (enrollError) {
      console.error("[Drip Processor] Query error:", enrollError.message);
      return NextResponse.json({ error: enrollError.message }, { status: 500 });
    }

    if (!enrollments?.length) {
      return NextResponse.json({ success: true, processed: 0, sent: 0, stopped: 0, failed: 0 });
    }

    let sent = 0;
    let stopped = 0;
    let failed = 0;

    for (const enrollment of enrollments as Enrollment[]) {
      try {
        const isEmail = enrollment.campaign_type === "email";

        if (isEmail) {
          // ── EMAIL DRIP BRANCH ──
          const { data: campaign } = await supabaseAdmin
            .from("email_campaigns")
            .select("id, status, type")
            .eq("id", enrollment.campaign_id)
            .single();

          if (!campaign || campaign.status !== "active") {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: "campaign_inactive" })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          const { data: emailSteps } = await supabaseAdmin
            .from("email_steps")
            .select("id, campaign_id, order, subject, preview_text, body_html, delay_hours, condition")
            .eq("campaign_id", enrollment.campaign_id)
            .order("order", { ascending: true });

          if (!emailSteps?.length) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          const currentStep = emailSteps.find(
            (s) => s.order === enrollment.current_step_order
          ) as EmailStepRow | undefined;

          if (!currentStep) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          // Condition check
          const condition = currentStep.condition as { check: string } | null;
          if (condition) {
            let conditionMet = false;
            if (condition.check === "booking_created") {
              const { count } = await supabaseAdmin
                .from("bookings")
                .select("id", { count: "exact", head: true })
                .eq("contact_id", enrollment.contact_id);
              conditionMet = (count ?? 0) > 0;
            }
            if (conditionMet) {
              await supabaseAdmin.from("drip_enrollments")
                .update({ status: "stopped", stopped_reason: condition.check, completed_at: now })
                .eq("id", enrollment.id);
              stopped++;
              continue;
            }
          }

          // Fetch contact (need email)
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select("id, email, first_name, last_name, company_name")
            .eq("id", enrollment.contact_id)
            .single();

          if (!contact?.email) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: "no_email" })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          // Variable substitution
          const variables: Record<string, string> = {
            first_name: contact.first_name || "there",
            last_name: contact.last_name || "",
            company_name: contact.company_name || "your company",
          };
          const rawSubject = renderVariables(currentStep.subject, variables);
          const rawBody = renderVariables(currentStep.body_html, variables);

          const rawPreview = currentStep.preview_text
            ? renderVariables(currentStep.preview_text, variables)
            : undefined;

          const { subject: resolvedSubject, html: resolvedBody } = await renderDripEmail({
            subject: rawSubject,
            bodyHtml: rawBody,
            preview: rawPreview,
          });

          // Send email
          const result = await sendEmail({
            to: contact.email,
            subject: resolvedSubject,
            html: resolvedBody,
            tags: [
              { name: "campaign_id", value: enrollment.campaign_id },
              { name: "step_id", value: currentStep.id },
            ],
          });

          // Insert email_sends record
          await supabaseAdmin.from("email_sends").insert({
            contact_id: contact.id,
            campaign_id: enrollment.campaign_id,
            step_id: currentStep.id,
            status: result.success ? "sent" : "failed",
            resend_message_id: result.messageId ?? null,
            sent_at: result.success ? now : null,
          });

          // Log activity
          await supabaseAdmin.from("activities").insert({
            contact_id: contact.id,
            type: "email_sent",
            title: `Drip: ${currentStep.subject}`,
            metadata: {
              campaign_id: enrollment.campaign_id,
              step_order: currentStep.order,
              subject: currentStep.subject,
            },
          });

          if (!result.success) {
            failed++;
            continue;
          }

          sent++;

          // Advance to next step
          const nextEmailStep = (emailSteps as EmailStepRow[]).find(
            (s) => s.order > currentStep.order
          );

          if (nextEmailStep) {
            const nextSendAt = new Date(
              Date.now() + nextEmailStep.delay_hours * 60 * 60 * 1000
            ).toISOString();
            await supabaseAdmin.from("drip_enrollments")
              .update({ current_step_order: nextEmailStep.order, next_send_at: nextSendAt })
              .eq("id", enrollment.id);
          } else {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
          }
        } else {
          // ── WHATSAPP DRIP BRANCH (original) ──
          const { data: campaign } = await supabaseAdmin
            .from("wa_campaigns")
            .select("id, status, type")
            .eq("id", enrollment.campaign_id)
            .single();

          if (!campaign || campaign.status !== "active") {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: "campaign_inactive" })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          const { data: steps } = await supabaseAdmin
            .from("wa_steps")
            .select("id, campaign_id, order, wa_template_name, wa_template_params, delay_hours, condition")
            .eq("campaign_id", enrollment.campaign_id)
            .order("order", { ascending: true });

          if (!steps?.length) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          const currentStep = steps.find(
            (s) => s.order === enrollment.current_step_order
          ) as WAStep | undefined;

          if (!currentStep) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          // Stop condition check
          const condition = currentStep.condition as { check: string } | null;
          if (condition) {
            let conditionMet = false;

            if (condition.check === "booking_created") {
              const { count } = await supabaseAdmin
                .from("bookings")
                .select("id", { count: "exact", head: true })
                .eq("contact_id", enrollment.contact_id);
              conditionMet = (count ?? 0) > 0;
            } else if (condition.check === "replied") {
              const { count } = await supabaseAdmin
                .from("wa_sends")
                .select("id", { count: "exact", head: true })
                .eq("contact_id", enrollment.contact_id)
                .eq("campaign_id", enrollment.campaign_id)
                .eq("replied", true);
              conditionMet = (count ?? 0) > 0;
            }

            if (conditionMet) {
              await supabaseAdmin.from("drip_enrollments")
                .update({
                  status: "stopped",
                  stopped_reason: condition.check,
                  completed_at: now,
                })
                .eq("id", enrollment.id);
              stopped++;
              continue;
            }
          }

          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select("id, phone, first_name, company_name")
            .eq("id", enrollment.contact_id)
            .single();

          if (!contact?.phone) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: "no_phone" })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          const rawParams = (currentStep.wa_template_params ?? []) as string[];
          const resolvedParams = rawParams.map((p) =>
            p
              .replace(/\{\{first_name\}\}/g, contact.first_name || "there")
              .replace(/\{\{company_name\}\}/g, contact.company_name || "your company")
          );

          const result = await sendTemplate(
            contact.phone,
            currentStep.wa_template_name,
            resolvedParams
          );

          await supabaseAdmin.from("wa_sends").insert({
            contact_id: contact.id,
            campaign_id: enrollment.campaign_id,
            step_id: currentStep.id,
            status: result.success ? "sent" : "failed",
            wa_message_id: result.messageId ?? null,
            sent_at: result.success ? now : null,
          });

          await supabaseAdmin.from("activities").insert({
            contact_id: contact.id,
            type: "wa_sent",
            title: `Drip: ${currentStep.wa_template_name}`,
            metadata: {
              campaign_id: enrollment.campaign_id,
              step_order: currentStep.order,
              template: currentStep.wa_template_name,
            },
          });

          if (!result.success) {
            failed++;
            continue;
          }

          sent++;

          const nextStep = (steps as WAStep[]).find(
            (s) => s.order > currentStep.order
          );

          if (nextStep) {
            const nextSendAt = new Date(
              Date.now() + nextStep.delay_hours * 60 * 60 * 1000
            ).toISOString();

            await supabaseAdmin.from("drip_enrollments")
              .update({
                current_step_order: nextStep.order,
                next_send_at: nextSendAt,
              })
              .eq("id", enrollment.id);
          } else {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
          }
        }
      } catch (err) {
        console.error(
          `[Drip Processor] Error processing enrollment ${enrollment.id}:`,
          err
        );
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: enrollments.length,
      sent,
      stopped,
      failed,
    });
  } catch (error) {
    console.error("[Drip Processor] Cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

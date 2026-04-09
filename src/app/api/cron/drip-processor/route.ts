import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTemplate } from "@/lib/whatsapp/client";
import { sendEmail, renderVariables, getUnsubscribeUrl } from "@/lib/email/client";
import { renderDripEmail } from "@/lib/email/templates/drip-wrapper";
import { renderDripWrapper } from "@/lib/email/templates/drip-wrapper";
import { evaluateCondition } from "@/lib/campaigns/condition-evaluators";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_LIMIT = 50;

interface Enrollment {
  id: string;
  contact_id: string;
  campaign_id: string;
  campaign_type: string;
  current_step_order: number;
  current_step_id: string | null;
  status: string;
  next_send_at: string;
}

interface WAStep {
  id: string;
  campaign_id: string;
  order: number;
  step_type: string;
  wa_template_name: string;
  wa_template_language: string | null;
  wa_template_params: string[] | null;
  wa_template_param_names: string[] | null;
  delay_hours: number;
  condition: { check: string; value?: string } | null;
  next_step_id_yes: string | null;
  next_step_id_no: string | null;
}

interface EmailStepRow {
  id: string;
  campaign_id: string;
  order: number;
  step_type: string;
  subject: string;
  preview_text: string | null;
  body_html: string;
  delay_hours: number;
  condition: { check: string; value?: string } | null;
  next_step_id_yes: string | null;
  next_step_id_no: string | null;
}

export { GET as POST };

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
      await logger.error("drip-processor", "Failed to query enrollments", { error: enrollError.message });
      return NextResponse.json({ error: enrollError.message }, { status: 500 });
    }

    let sent = 0;
    let stopped = 0;
    let failed = 0;

    for (const enrollment of (enrollments ?? []) as Enrollment[]) {
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
            .select("id, campaign_id, order, step_type, subject, preview_text, body_html, delay_hours, condition, next_step_id_yes, next_step_id_no")
            .eq("campaign_id", enrollment.campaign_id)
            .order("order", { ascending: true });

          if (!emailSteps?.length) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          const steps = emailSteps as EmailStepRow[];
          const stepMap = new Map(steps.map((s) => [s.id, s]));

          // Resolve current step: prefer step ID, fallback to order
          let currentStep: EmailStepRow | undefined;
          if (enrollment.current_step_id) {
            currentStep = stepMap.get(enrollment.current_step_id);
          }
          if (!currentStep) {
            currentStep = steps.find((s) => s.order === enrollment.current_step_order);
          }

          if (!currentStep) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          // ── Handle condition-only steps (step_type === 'condition') ──
          // These don't send emails; they just branch. Resolve immediately.
          const visitedSteps = new Set<string>();
          while (currentStep.step_type === "condition" && currentStep.condition) {
            // Loop protection
            if (visitedSteps.has(currentStep.id)) {
              await supabaseAdmin.from("drip_enrollments")
                .update({ status: "stopped", stopped_reason: "loop_detected", completed_at: now })
                .eq("id", enrollment.id);
              break;
            }
            visitedSteps.add(currentStep.id);

            const conditionMet = await evaluateCondition(
              currentStep.condition.check,
              enrollment.contact_id,
              enrollment.campaign_id
            );

            const nextStepId = conditionMet
              ? currentStep.next_step_id_yes
              : currentStep.next_step_id_no;

            if (!nextStepId) {
              // Branch leads nowhere → complete
              await supabaseAdmin.from("drip_enrollments")
                .update({ status: "completed", completed_at: now })
                .eq("id", enrollment.id);
              break;
            }

            const nextStep = stepMap.get(nextStepId);
            if (!nextStep) {
              await supabaseAdmin.from("drip_enrollments")
                .update({ status: "completed", completed_at: now })
                .eq("id", enrollment.id);
              break;
            }

            // If next step has a delay, schedule it and stop processing this tick
            if (nextStep.delay_hours > 0) {
              const nextSendAt = new Date(
                Date.now() + nextStep.delay_hours * 60 * 60 * 1000
              ).toISOString();
              await supabaseAdmin.from("drip_enrollments")
                .update({
                  current_step_id: nextStep.id,
                  current_step_order: nextStep.order,
                  next_send_at: nextSendAt,
                })
                .eq("id", enrollment.id);
              currentStep = undefined as unknown as EmailStepRow; // signal we're done
              break;
            }

            // No delay — continue resolving
            currentStep = nextStep;
          }

          // If we broke out due to completion/scheduling, skip to next enrollment
          if (!currentStep || visitedSteps.has(currentStep.id) && currentStep.step_type === "condition") {
            continue;
          }

          // ── Condition check on send steps (legacy + branching) ──
          if (currentStep.condition && currentStep.step_type === "send") {
            const conditionMet = await evaluateCondition(
              currentStep.condition.check,
              enrollment.contact_id,
              enrollment.campaign_id
            );

            if (conditionMet) {
              // Branching: follow yes path if available
              if (currentStep.next_step_id_yes) {
                const yesStep = stepMap.get(currentStep.next_step_id_yes);
                if (yesStep) {
                  const nextSendAt = yesStep.delay_hours > 0
                    ? new Date(Date.now() + yesStep.delay_hours * 60 * 60 * 1000).toISOString()
                    : now;
                  await supabaseAdmin.from("drip_enrollments")
                    .update({
                      current_step_id: yesStep.id,
                      current_step_order: yesStep.order,
                      next_send_at: nextSendAt,
                    })
                    .eq("id", enrollment.id);
                } else {
                  await supabaseAdmin.from("drip_enrollments")
                    .update({ status: "completed", completed_at: now })
                    .eq("id", enrollment.id);
                }
              } else {
                // Legacy: no branching pointers → stop enrollment
                await supabaseAdmin.from("drip_enrollments")
                  .update({ status: "stopped", stopped_reason: currentStep.condition.check, completed_at: now })
                  .eq("id", enrollment.id);
              }
              stopped++;
              continue;
            }
          }

          // Fetch contact
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select("id, email, first_name, last_name, company_name, deleted_at, email_unsubscribed_at")
            .eq("id", enrollment.contact_id)
            .single();

          if (!contact || contact.deleted_at) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: contact?.deleted_at ? "contact_deleted" : "contact_not_found" })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          if (contact.email_unsubscribed_at) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: "unsubscribed" })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          if (!contact.email) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: "no_email" })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          // Variable substitution
          const unsubscribeUrl = getUnsubscribeUrl(contact.id);
          const variables: Record<string, string> = {
            first_name: contact.first_name || "there",
            last_name: contact.last_name || "",
            company_name: contact.company_name || "your company",
            unsubscribe_link: unsubscribeUrl,
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
            unsubscribeUrl,
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

          if (!result.success) {
            failed++;
            continue;
          }

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

          sent++;

          // ── Advance to next step ──
          let nextStep: EmailStepRow | undefined;

          if (currentStep.next_step_id_no) {
            // Branching campaign: follow the "no" (default/next) pointer
            nextStep = stepMap.get(currentStep.next_step_id_no);
          } else {
            // Legacy linear: find next by order
            nextStep = steps.find((s) => s.order > currentStep!.order);
          }

          if (nextStep) {
            const nextSendAt = new Date(
              Date.now() + nextStep.delay_hours * 60 * 60 * 1000
            ).toISOString();
            await supabaseAdmin.from("drip_enrollments")
              .update({
                current_step_id: nextStep.id,
                current_step_order: nextStep.order,
                next_send_at: nextSendAt,
              })
              .eq("id", enrollment.id);
          } else {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
          }
        } else {
          // ── WHATSAPP DRIP BRANCH (with branching support) ──
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

          const { data: waSteps } = await supabaseAdmin
            .from("wa_steps")
            .select("id, campaign_id, order, step_type, wa_template_name, wa_template_language, wa_template_params, wa_template_param_names, delay_hours, condition, next_step_id_yes, next_step_id_no")
            .eq("campaign_id", enrollment.campaign_id)
            .order("order", { ascending: true });

          if (!waSteps?.length) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          const steps = waSteps as unknown as WAStep[];
          const stepMap = new Map(steps.map((s) => [s.id, s]));

          // Resolve current step: prefer step ID, fallback to order
          let currentStep: WAStep | undefined;
          if (enrollment.current_step_id) {
            currentStep = stepMap.get(enrollment.current_step_id);
          }
          if (!currentStep) {
            currentStep = steps.find((s) => s.order === enrollment.current_step_order);
          }

          if (!currentStep) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          // ── Handle condition-only steps (step_type === 'condition') ──
          const visitedSteps = new Set<string>();
          while (currentStep.step_type === "condition" && currentStep.condition) {
            if (visitedSteps.has(currentStep.id)) {
              await supabaseAdmin.from("drip_enrollments")
                .update({ status: "stopped", stopped_reason: "loop_detected", completed_at: now })
                .eq("id", enrollment.id);
              break;
            }
            visitedSteps.add(currentStep.id);

            const conditionMet = await evaluateCondition(
              currentStep.condition.check,
              enrollment.contact_id,
              enrollment.campaign_id
            );

            const nextStepId = conditionMet
              ? currentStep.next_step_id_yes
              : currentStep.next_step_id_no;

            if (!nextStepId) {
              await supabaseAdmin.from("drip_enrollments")
                .update({ status: "completed", completed_at: now })
                .eq("id", enrollment.id);
              break;
            }

            const nextStep = stepMap.get(nextStepId);
            if (!nextStep) {
              await supabaseAdmin.from("drip_enrollments")
                .update({ status: "completed", completed_at: now })
                .eq("id", enrollment.id);
              break;
            }

            if (nextStep.delay_hours > 0) {
              const nextSendAt = new Date(
                Date.now() + nextStep.delay_hours * 60 * 60 * 1000
              ).toISOString();
              await supabaseAdmin.from("drip_enrollments")
                .update({
                  current_step_id: nextStep.id,
                  current_step_order: nextStep.order,
                  next_send_at: nextSendAt,
                })
                .eq("id", enrollment.id);
              currentStep = undefined as unknown as WAStep;
              break;
            }

            currentStep = nextStep;
          }

          // If we broke out due to completion/scheduling, skip to next enrollment
          if (!currentStep || (visitedSteps.has(currentStep.id) && currentStep.step_type === "condition")) {
            continue;
          }

          // ── Condition check on send steps (legacy + branching) ──
          if (currentStep.condition && currentStep.step_type === "send") {
            const conditionMet = await evaluateCondition(
              currentStep.condition.check,
              enrollment.contact_id,
              enrollment.campaign_id
            );

            if (conditionMet) {
              if (currentStep.next_step_id_yes) {
                const yesStep = stepMap.get(currentStep.next_step_id_yes);
                if (yesStep) {
                  const nextSendAt = yesStep.delay_hours > 0
                    ? new Date(Date.now() + yesStep.delay_hours * 60 * 60 * 1000).toISOString()
                    : now;
                  await supabaseAdmin.from("drip_enrollments")
                    .update({
                      current_step_id: yesStep.id,
                      current_step_order: yesStep.order,
                      next_send_at: nextSendAt,
                    })
                    .eq("id", enrollment.id);
                } else {
                  await supabaseAdmin.from("drip_enrollments")
                    .update({ status: "completed", completed_at: now })
                    .eq("id", enrollment.id);
                }
              } else {
                // Legacy: no branching pointers → stop enrollment
                await supabaseAdmin.from("drip_enrollments")
                  .update({ status: "stopped", stopped_reason: currentStep.condition.check, completed_at: now })
                  .eq("id", enrollment.id);
              }
              stopped++;
              continue;
            }
          }

          // ── Fetch contact ──
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select("id, phone, first_name, company_name, deleted_at")
            .eq("id", enrollment.contact_id)
            .single();

          if (!contact || contact.deleted_at) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: contact?.deleted_at ? "contact_deleted" : "contact_not_found" })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          if (!contact.phone) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: "no_phone" })
              .eq("id", enrollment.id);
            stopped++;
            continue;
          }

          // ── Send WhatsApp template ──
          const rawParams = (currentStep.wa_template_params ?? []) as string[];
          const paramNames = (currentStep.wa_template_param_names ?? []) as string[];
          const resolvedParams = rawParams.map((p) =>
            p
              .replace(/\{\{first_name\}\}/g, contact.first_name || "there")
              .replace(/\{\{company_name\}\}/g, contact.company_name || "your company")
          );

          const result = await sendTemplate(
            contact.phone,
            currentStep.wa_template_name,
            resolvedParams,
            currentStep.wa_template_language || "en",
            paramNames.length > 0 ? paramNames : undefined
          );

          await supabaseAdmin.from("wa_sends").insert({
            contact_id: contact.id,
            campaign_id: enrollment.campaign_id,
            step_id: currentStep.id,
            status: result.success ? "sent" : "failed",
            wa_message_id: result.messageId ?? null,
            sent_at: result.success ? now : null,
            error_message: result.success ? null : (result.error ?? "Unknown error"),
          });

          if (!result.success) {
            await logger.error("drip-processor", `WA send failed for enrollment ${enrollment.id}`, {
              enrollment_id: enrollment.id,
              campaign_id: enrollment.campaign_id,
              contact_id: contact.id,
              phone: contact.phone,
              template: currentStep.wa_template_name,
              step_order: currentStep.order,
              error: result.error,
            });
            await supabaseAdmin.from("activities").insert({
              contact_id: contact.id,
              type: "wa_sent",
              title: `Drip failed: ${currentStep.wa_template_name}`,
              metadata: {
                campaign_id: enrollment.campaign_id,
                step_order: currentStep.order,
                template: currentStep.wa_template_name,
                error: result.error,
              },
            });
            // Stop enrollment to prevent infinite retry loop
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: `send_failed: ${result.error?.slice(0, 100) ?? "unknown"}` })
              .eq("id", enrollment.id);
            failed++;
            continue;
          }

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

          sent++;

          // ── Advance to next step ──
          let nextStep: WAStep | undefined;

          if (currentStep.next_step_id_no) {
            // Branching campaign: follow the "no" (default/next) pointer
            nextStep = stepMap.get(currentStep.next_step_id_no);
          } else {
            // Legacy linear: find next by order
            nextStep = steps.find((s) => s.order > currentStep!.order);
          }

          if (nextStep) {
            const nextSendAt = new Date(
              Date.now() + nextStep.delay_hours * 60 * 60 * 1000
            ).toISOString();

            await supabaseAdmin.from("drip_enrollments")
              .update({
                current_step_id: nextStep.id,
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
        // Stop the enrollment to prevent infinite retries and duplicate sends
        await supabaseAdmin.from("drip_enrollments")
          .update({ status: "stopped", stopped_reason: "processing_error" })
          .eq("id", enrollment.id);
        failed++;
      }
    }

    // ── ONE-TIME / NEWSLETTER DISPATCH ──
    // Process queued email_sends (ported from email-dispatcher)
    let oneTimeSent = 0;
    let oneTimeFailed = 0;

    const { data: queuedSends } = await supabaseAdmin
      .from("email_sends")
      .select("id, campaign_id, step_id, contact_id")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (queuedSends?.length) {
      const stepIds = [...new Set(queuedSends.map((s) => s.step_id).filter(Boolean))] as string[];
      const contactIds = [...new Set(queuedSends.map((s) => s.contact_id))];

      const [{ data: qSteps }, { data: qContacts }] = await Promise.all([
        supabaseAdmin.from("email_steps").select("id, subject, preview_text, body_html").in("id", stepIds),
        supabaseAdmin.from("contacts").select("id, first_name, last_name, email, company_name, email_unsubscribed_at").in("id", contactIds),
      ]);

      const qStepMap = new Map<string, { subject: string; preview_text: string | null; body_html: string }>();
      for (const s of qSteps ?? []) qStepMap.set(s.id, s);

      // Track unsubscribed contacts separately so we don't mark them as "failed"
      const unsubscribedContactIds = new Set<string>();
      const qContactMap = new Map<string, { email: string; first_name: string | null; last_name: string | null; company_name: string | null }>();
      for (const c of qContacts ?? []) {
        if (c.email_unsubscribed_at) {
          unsubscribedContactIds.add(c.id);
        } else if (c.email) {
          qContactMap.set(c.id, { email: c.email, first_name: c.first_name, last_name: c.last_name, company_name: c.company_name });
        }
      }

      // Pre-render wrappers per step
      const wrapperCache = new Map<string, { wrapperHtml: string; placeholder: string }>();
      for (const [stepId, step] of qStepMap) {
        const result = await renderDripWrapper({ preview: step.preview_text ?? step.subject });
        wrapperCache.set(stepId, result);
      }

      const CONCURRENCY = 10;
      async function processQueuedSend(send: { id: string; campaign_id: string | null; step_id: string | null; contact_id: string }) {
        const step = send.step_id ? qStepMap.get(send.step_id) : null;
        const contact = qContactMap.get(send.contact_id);
        const wrapper = send.step_id ? wrapperCache.get(send.step_id) : null;

        // Skip unsubscribed contacts — mark as skipped, not failed
        if (unsubscribedContactIds.has(send.contact_id)) {
          await supabaseAdmin.from("email_sends").update({ status: "failed" }).eq("id", send.id);
          return false;
        }

        if (!step || !contact || !wrapper) {
          console.error(`[Drip Processor] Missing data for send ${send.id}: step=${!!step} contact=${!!contact} wrapper=${!!wrapper}`);
          await supabaseAdmin.from("email_sends").update({ status: "failed" }).eq("id", send.id);
          return false;
        }

        const unsubscribeUrl = getUnsubscribeUrl(send.contact_id);
        const vars: Record<string, string> = {
          first_name: contact.first_name ?? "",
          last_name: contact.last_name ?? "",
          full_name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
          email: contact.email,
          company_name: contact.company_name ?? "",
          unsubscribe_link: unsubscribeUrl,
        };

        const subject = renderVariables(step.subject, vars);
        const bodyHtml = renderVariables(step.body_html, vars);
        const html = wrapper.wrapperHtml
          .replace(wrapper.placeholder, bodyHtml)
          .replace(/href="#"/, `href="${unsubscribeUrl}"`);

        const result = await sendEmail({
          to: contact.email,
          subject,
          html,
          tags: [
            { name: "campaign_id", value: send.campaign_id ?? "unknown" },
            { name: "send_id", value: send.id },
          ],
        });

        if (result.success) {
          await Promise.all([
            supabaseAdmin.from("email_sends").update({
              status: "sent",
              sent_at: new Date().toISOString(),
              resend_message_id: result.messageId ?? null,
            }).eq("id", send.id),
            supabaseAdmin.from("activities").insert({
              contact_id: send.contact_id,
              type: "email_sent",
              title: `Campaign email sent: ${subject}`,
            }),
          ]);
          return true;
        } else {
          await supabaseAdmin.from("email_sends").update({ status: "failed" }).eq("id", send.id);
          return false;
        }
      }

      for (let i = 0; i < queuedSends.length; i += CONCURRENCY) {
        const chunk = queuedSends.slice(i, i + CONCURRENCY);
        const results = await Promise.all(chunk.map(processQueuedSend));
        for (const ok of results) {
          if (ok) oneTimeSent++;
          else oneTimeFailed++;
        }
      }

      // Mark campaigns as completed if all sends are done
      const campaignIds = [...new Set(queuedSends.map((s) => s.campaign_id).filter(Boolean))];
      for (const campaignId of campaignIds) {
        const { count } = await supabaseAdmin
          .from("email_sends")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId!)
          .eq("status", "queued");
        if (count === 0) {
          await supabaseAdmin
            .from("email_campaigns")
            .update({ status: "completed" })
            .eq("id", campaignId!)
            .in("type", ["one_time", "newsletter"]);
        }
      }
    }

    const total = (enrollments ?? []).length;
    if (total > 0 || oneTimeSent > 0 || oneTimeFailed > 0) {
      await logger.info("drip-processor", `Run complete: ${sent} sent, ${failed} failed, ${stopped} stopped`, {
        processed: total,
        sent,
        stopped,
        failed,
        one_time_sent: oneTimeSent,
        one_time_failed: oneTimeFailed,
      });
    }

    return NextResponse.json({
      success: true,
      processed: total,
      sent,
      stopped,
      failed,
      one_time_sent: oneTimeSent,
      one_time_failed: oneTimeFailed,
    });
  } catch (error) {
    await logger.error("drip-processor", `Cron error: ${error instanceof Error ? error.message : "Unknown"}`);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createEvent } from "@/lib/google/calendar";
import { sendEmail } from "@/lib/email/client";
import { renderWelcomeEmail } from "@/lib/email/templates/welcome";
import { autoEnrollIntoDrips } from "@/lib/contacts/auto-enroll";
import { enrollContactByTrigger } from "@/lib/campaigns/trigger-enroll";
import { logger } from "@/lib/logger";
import type { AvailabilityRules } from "@/types/bookings";

/**
 * POST /api/bookings
 * Public endpoint — creates a booking from the public booking page.
 *
 * Body: {
 *   slug: string,
 *   date: string (YYYY-MM-DD),
 *   time: string (HH:MM),
 *   assignedTo: string (team member ID),
 *   formData: Record<string, string>,
 * }
 *
 * Steps:
 * 1. Validate booking page + slot availability
 * 2. Find or create contact
 * 3. Move contact to "121 Booked" stage
 * 4. Create booking record
 * 5. Create Google Calendar event with Meet link
 * 6. Send confirmation email (if enabled)
 * 7. Log activities
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { slug, date, time, assignedTo, formData, trackingParams } = body as {
    slug?: string;
    date?: string;
    time?: string;
    assignedTo?: string;
    formData?: Record<string, string>;
    trackingParams?: Record<string, string>;
  };

  if (!slug || !date || !time || !formData) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // ── Step 1: Fetch booking page ─────────────────
  const { data: page, error: pageError } = await supabaseAdmin
    .from("booking_pages")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (pageError || !page) {
    return NextResponse.json({ error: "Booking page not found" }, { status: 404 });
  }

  const rules = page.availability_rules as unknown as AvailabilityRules | null;
  const duration = page.duration_minutes;
  const tz = rules?.timezone ?? "Asia/Kolkata";

  // Calculate start and end times
  const startStr = `${date}T${time}:00`;
  const startDate = parseDateInTz(startStr, tz);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  // Determine assigned team member — must have Google Calendar connected
  // to be able to create the calendar event.
  const assignedIds: string[] = page.assigned_to ?? [];

  // Fetch connected team members upfront (avoids multiple queries below)
  const { data: connectedMembers } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("is_active", true)
    .eq("google_calendar_connected", true)
    .in("id", assignedIds.length > 0 ? assignedIds : ["__none__"]);

  const connectedIds = new Set((connectedMembers ?? []).map((m) => m.id));

  let teamMemberId: string | null = null;

  if (assignedTo && connectedIds.has(assignedTo)) {
    // Use the member the availability engine selected (already connected)
    teamMemberId = assignedTo;
  } else if (assignedTo && !connectedIds.has(assignedTo)) {
    // The chosen member isn't connected — fall back to any connected assigned member
    teamMemberId = [...connectedIds][0] ?? null;
    console.warn(`[Booking] assignedTo ${assignedTo} not connected, falling back to ${teamMemberId}`);
  } else if (assignedIds.length > 0) {
    // No assignedTo provided — pick first connected member from page's assigned list
    const firstConnected = assignedIds.find((id) => connectedIds.has(id));
    if (firstConnected) {
      teamMemberId = firstConnected;
    } else {
      // None of the assigned members are connected — pick any connected active member
      const { data: anyMember } = await supabaseAdmin
        .from("team_members")
        .select("id")
        .eq("is_active", true)
        .eq("google_calendar_connected", true)
        .limit(1)
        .maybeSingle();
      teamMemberId = anyMember?.id ?? null;
    }
  } else {
    // No assigned members configured at all — pick any connected active member
    const { data: anyMember } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("is_active", true)
      .eq("google_calendar_connected", true)
      .limit(1)
      .maybeSingle();
    teamMemberId = anyMember?.id ?? null;
  }

  // Extract form data by field type from the booking page's form_fields config,
  // then fall back to hardcoded label names for backwards compatibility.
  const fields: { label: string; type: string }[] =
    (page.form_fields as unknown as { label: string; type: string }[]) || [];

  function findByType(type: string): string {
    const field = fields.find((f) => f.type === type);
    if (!field || !formData) return "";
    return (formData[field.label] || "").trim();
  }

  const emailByType = findByType("email");
  const email = (emailByType || formData["Email"] || formData["email"] || "").toLowerCase().trim();
  const phoneByType = findByType("phone");
  const rawPhone = (phoneByType || formData["Whatsapp/Phone number"] || formData["Phone Number"] || formData["phone"] || "").replace(/\s+/g, "");
  // Normalize to E.164-ish: prepend +91 if no country code present
  const phone = rawPhone && !rawPhone.startsWith("+") ? `+91${rawPhone}` : rawPhone;
  const linkedinUrl = formData["Share your LinkedIn profile link"] || formData["LinkedIn Profile"] || formData["linkedin_url"] || "";

  let firstName: string;
  let lastName: string | undefined;

  // Try to find a name from a text field whose label contains "name"
  const nameFields = fields.filter((f) => f.type === "text" && /name/i.test(f.label));
  const firstNameField = nameFields.find((f) => /first/i.test(f.label));
  const lastNameField = nameFields.find((f) => /last/i.test(f.label));

  if (firstNameField || lastNameField) {
    const fnLabel = firstNameField ? firstNameField.label : "";
    const lnLabel = lastNameField ? lastNameField.label : "";
    firstName = (formData[fnLabel] || "").trim() || "Unknown";
    lastName = (formData[lnLabel] || "").trim() || undefined;
  } else if (formData["First Name"] || formData["Last Name"]) {
    firstName = (formData["First Name"] || "").trim() || "Unknown";
    lastName = (formData["Last Name"] || "").trim() || undefined;
  } else {
    // Fall back to any field with "name" in label, then first required text field
    const fullNameField = nameFields[0];
    const rawName = fullNameField ? formData[fullNameField.label] : null;
    const firstTextField = !rawName
      ? fields.find((f) => f.type === "text" && formData[f.label])
      : null;
    const fullName = rawName || formData["Full Name"] || formData["full_name"] || (firstTextField ? formData[firstTextField.label] : "") || "";
    const nameParts = fullName.trim().split(/\s+/);
    firstName = nameParts[0] || "Unknown";
    lastName = nameParts.slice(1).join(" ") || undefined;
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  if (!email) {
    return NextResponse.json(
      { error: "Email is required. Please add an email field to your booking page form." },
      { status: 400 }
    );
  }

  // ── Step 2: Find or create contact ─────────────
  let existingContact: { id: string; funnel_id: string | null; current_stage_id: string | null; metadata: unknown; linkedin_url: string | null; phone: string | null } | null = null;

  // Check by email first
  const { data: byEmail } = await supabaseAdmin
    .from("contacts")
    .select("id, funnel_id, current_stage_id, metadata, linkedin_url, phone")
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  existingContact = byEmail;

  // If no email match and phone provided, fall back to phone lookup
  if (!existingContact && phone) {
    const { data: byPhone } = await supabaseAdmin
      .from("contacts")
      .select("id, funnel_id, current_stage_id, metadata, linkedin_url, phone")
      .eq("phone", phone)
      .is("deleted_at", null)
      .maybeSingle();

    existingContact = byPhone;
  }

  let contactId: string;
  let contactFunnelId: string | null;
  let isNewContact = false;

  if (existingContact) {
    contactId = existingContact.id;
    contactFunnelId = existingContact.funnel_id;
  } else {
    // Get default funnel + first stage
    const { data: defaultFunnel } = await supabaseAdmin
      .from("funnels")
      .select("id")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    const funnelId = defaultFunnel?.id ?? null;
    let firstStageId: string | null = null;

    if (funnelId) {
      const { data: firstStage } = await supabaseAdmin
        .from("funnel_stages")
        .select("id")
        .eq("funnel_id", funnelId)
        .order("order", { ascending: true })
        .limit(1)
        .maybeSingle();

      firstStageId = firstStage?.id ?? null;
    }

    const { data: newContact, error: insertError } = await supabaseAdmin
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        linkedin_url: linkedinUrl || null,
        source: trackingParams?.utm_source || "booking_page",
        type: "prospect",
        tags: ["booking"],
        funnel_id: funnelId,
        current_stage_id: firstStageId,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[Booking] Contact insert error:", insertError.message);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    contactId = newContact.id;
    contactFunnelId = funnelId;
    isNewContact = true;
  }

  // ── Step 3: Move to "121 Booked" stage ─────────
  if (contactFunnelId) {
    const { data: bookedStage } = await supabaseAdmin
      .from("funnel_stages")
      .select("id")
      .eq("funnel_id", contactFunnelId)
      .eq("name", "121 Booked")
      .maybeSingle();

    if (bookedStage) {
      const { data: currentContact } = await supabaseAdmin
        .from("contacts")
        .select("metadata, linkedin_url, phone")
        .eq("id", contactId)
        .single();

      const existingMeta =
        (currentContact?.metadata as Record<string, unknown>) ?? {};

      const stageUpdate: Record<string, unknown> = {
        current_stage_id: bookedStage.id,
        metadata: {
          ...existingMeta,
          call_booked: "yes",
          booked_at: startDate.toISOString(),
          booking_page: slug,
          form_responses: formData,
          ...(trackingParams && Object.keys(trackingParams).length > 0 ? trackingParams : {}),
        },
      };

      // Fill linkedin_url if provided and missing
      if (linkedinUrl && !currentContact?.linkedin_url) {
        stageUpdate.linkedin_url = linkedinUrl;
      }
      // Fill phone if missing
      if (phone && !currentContact?.phone) {
        stageUpdate.phone = phone;
      }

      await supabaseAdmin
        .from("contacts")
        .update(stageUpdate)
        .eq("id", contactId);
    }
  }

  // ── Step 4: Create booking record ──────────────
  let meetLink: string | null = null;
  let googleEventId: string | null = null;

  // ── Step 5: Create Google Calendar event ───────
  if (teamMemberId) {
    const eventResult = await createEvent(teamMemberId, {
      summary: `${page.title} — ${fullName}`,
      description: formatEventDescription(formData, page.title),
      start: startDate,
      end: endDate,
      attendeeEmail: email,
      timeZone: tz,
    });

    if (eventResult.success) {
      googleEventId = eventResult.eventId ?? null;
      meetLink = eventResult.meetLink ?? null;
    } else {
      console.error("[Booking] Calendar event error:", eventResult.error);
      // Log to activities so the error is visible in the SalesHub UI
      await supabaseAdmin.from("activities").insert({
        contact_id: contactId,
        type: "note",
        title: "⚠️ Google Calendar event failed",
        metadata: { error: eventResult.error, team_member_id: teamMemberId },
      });

      // Alert the assigned team member via email
      const { data: assignedMember } = await supabaseAdmin
        .from("team_members")
        .select("email, name")
        .eq("id", teamMemberId)
        .single();

      if (assignedMember?.email) {
        sendEmail({
          to: assignedMember.email,
          subject: `Booking Alert: Calendar event failed for ${fullName}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#e53e3e">Calendar Event Failed</h2>
              <p>Hi ${assignedMember.name},</p>
              <p>A booking was created for <strong>${fullName}</strong> (${email}) but the Google Calendar event could not be created.</p>
              <p><strong>Date:</strong> ${startDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              <p><strong>Time:</strong> ${startDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}</p>
              <p style="color:#e53e3e"><strong>Please manually add this to your calendar.</strong></p>
              <p>Error: ${eventResult.error ?? "Unknown"}</p>
              <hr style="margin:30px 0;border:none;border-top:1px solid #eee" />
              <p style="color:#999;font-size:12px">SalesHub — Xperience Wave</p>
            </div>
          `,
        }).catch(() => {}); // fire-and-forget
      }
    }
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .insert({
      contact_id: contactId,
      booking_page_id: page.id,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      assigned_to: teamMemberId,
      meet_link: meetLink,
      google_event_id: googleEventId,
      status: "confirmed",
      notes: JSON.stringify(formData),
    })
    .select("id")
    .single();

  if (bookingError) {
    // Check for unique constraint violation (concurrent slot booking)
    if (bookingError.code === "23505") {
      return NextResponse.json(
        { error: "This time slot was just booked by someone else. Please select a different time.", code: "SLOT_TAKEN" },
        { status: 409 }
      );
    }
    console.error("[Booking] Insert error:", bookingError.message);
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  // ── Step 5b: Save qualifying data to contact_form_responses ───
  if (formData && Object.keys(formData).length > 0) {
    type WorkExp = "fresher" | "<2_years" | "3-5_years" | "5-10_years" | "10+_years";
    type Financial = "ready" | "careful_but_open" | "not_ready";
    type Urgency = "right_now" | "within_90_days" | "more_than_90_days";

    const fd = formData as Record<string, string>;

    const findField = (keywords: string[]): string | null => {
      const entry = Object.entries(fd).find(([k]) =>
        keywords.every((kw) => k.toLowerCase().includes(kw))
      );
      return entry?.[1]?.trim() || null;
    };

    const mapWorkExp = (v: string | null): WorkExp | null => {
      if (!v) return null;
      const s = v.toLowerCase();
      if (s.includes("< 2") || s.includes("less than 2") || s.includes("0-2") || s.includes("under 2")) return "<2_years";
      if (s.includes("2-5") || s.includes("2 to 5") || s.includes("2–5") || s.includes("3-5") || s.includes("3 to 5")) return "3-5_years";
      if (s.includes("5-10") || s.includes("5 to 10") || s.includes("5–10")) return "5-10_years";
      if (s.includes("10+") || s.includes("more than 10") || s.includes("over 10")) return "10+_years";
      if (s.includes("fresh") || s.includes("0 year") || s.includes("no exp")) return "fresher";
      return null;
    };

    const mapFinancial = (v: string | null): Financial | null => {
      if (!v) return null;
      const s = v.toLowerCase();
      if (s.includes("tight") || s.includes("not ready") || s.includes("cannot") || s.includes("can't")) return "not_ready";
      if (s.includes("careful") || s.includes("saving") || s.includes("almost") || s.includes("stretch")) return "careful_but_open";
      if (s.includes("ready") || s.includes("100%") || s.includes("yes")) return "ready";
      return null;
    };

    const mapUrgency = (v: string | null): Urgency | null => {
      if (!v) return null;
      const s = v.toLowerCase();
      if (s.includes("right now") || s.includes("immediately") || s.includes("asap")) return "right_now";
      if (s.includes("3 month") || s.includes("next month") || s.includes("soon") || s.includes("90 day")) return "within_90_days";
      if (s.includes("6 month") || s.includes("year") || s.includes("later") || s.includes("exploring")) return "more_than_90_days";
      return null;
    };

    const { error: cfError } = await supabaseAdmin.from("contact_form_responses").insert({
      contact_id: contactId,
      booking_id: booking.id,
      form_email: email,
      work_experience: mapWorkExp(findField(["work", "experience"])),
      current_role: findField(["role"]),
      key_challenge: findField(["challenge"]),
      desired_salary: findField(["salary"]),
      blocker: findField(["stopping"]),
      financial_readiness: mapFinancial(findField(["financial"])),
      urgency: mapUrgency(findField(["soon"])) ?? mapUrgency(findField(["ready"])),
    });

    if (cfError) {
      console.error("[Booking] contact_form_responses insert error:", cfError.message);
    }
  }

  // ── Step 6: Log activity ───────────────────────
  await supabaseAdmin.from("activities").insert({
    contact_id: contactId,
    type: "booking_created",
    title: `Call booked: ${page.title}`,
    metadata: {
      source: "booking_page",
      booking_id: booking.id,
      slug,
      booked_at: startDate.toISOString(),
    },
  });

  // ── Step 6b: Trigger campaign enrollment for "booking_confirmed" ──
  await enrollContactByTrigger(contactId, "booking_confirmed").catch(() => {});

  // ── Step 7: Send confirmation email ────────────
  if (page.confirmation_email && email) {
    try {
      const formattedDate = startDate.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: tz,
      });
      const formattedTime = startDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      });

      const emailSubject = `Booking Confirmed: ${page.title}`;
      const result = await sendEmail({
        to: email,
        subject: emailSubject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your booking is confirmed!</h2>
            <p>Hi ${firstName},</p>
            <p>Your <strong>${page.title}</strong> has been scheduled.</p>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${formattedTime} IST</p>
              <p style="margin: 4px 0;"><strong>Duration:</strong> ${duration} minutes</p>
              ${meetLink ? `<p style="margin: 4px 0;"><strong>Meet Link:</strong> <a href="${meetLink}">${meetLink}</a></p>` : ""}
            </div>
            <p>We look forward to speaking with you!</p>
            <p>— Team Xperience Wave</p>
          </div>
        `,
      });

      if (result.success) {
        await Promise.all([
          supabaseAdmin.from("activities").insert({
            contact_id: contactId,
            type: "email_sent",
            title: "Booking confirmation email sent",
            metadata: { template: "booking-confirmation", booking_id: booking.id },
          }),
          supabaseAdmin.from("email_sends").insert({
            contact_id: contactId,
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_message_id: result.messageId ?? null,
          }),
        ]);
      }
    } catch (err) {
      console.error("[Booking] Email error:", err);
    }
  }

  // ── Step 7b: Welcome email + drip enrollment (new contacts only) ──
  if (isNewContact) {
    try {
      const { subject, html } = await renderWelcomeEmail({ firstName });
      const welcomeResult = await sendEmail({ to: email, subject, html });
      if (welcomeResult.success) {
        await Promise.all([
          supabaseAdmin.from("activities").insert({
            contact_id: contactId,
            type: "email_sent",
            title: "Welcome email sent",
            metadata: { template: "welcome" },
          }),
          supabaseAdmin.from("email_sends").insert({
            contact_id: contactId,
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_message_id: welcomeResult.messageId ?? null,
          }),
        ]);
      } else {
        console.error("[Booking] Welcome email failed:", welcomeResult.error);
      }
    } catch (emailErr) {
      console.error("[Booking] Welcome email failed:", emailErr);
    }

    try {
      await autoEnrollIntoDrips(contactId);
    } catch (err) {
      console.error("[Booking] Drip auto-enroll error:", err);
    }
  }

  // ── Step 8: Return success ─────────────────────
  await logger.info("booking", `Booking created for ${email}`, {
    contact_id: contactId,
    booking_id: booking.id,
    email,
    date,
    time,
    slug,
  });

  return NextResponse.json({
    success: true,
    booking_id: booking.id,
    meet_link: meetLink,
  }, { status: 201 });
}

// ── Helpers ──────────────────────────────────────

function parseDateInTz(dateStr: string, tz: string): Date {
  if (dateStr.includes("Z") || dateStr.includes("+")) {
    return new Date(dateStr);
  }

  // Parse components from the string directly (no new Date() which uses local tz)
  const [datePart, timePart] = dateStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = (timePart || "00:00:00").split(":").map(Number);

  // Create a UTC date with these components first
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0));

  // Find out what wall-clock time `utcGuess` would show in the target timezone
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(utcGuess);
  const p = (type: string) => Number(parts.find((x) => x.type === type)?.value || 0);
  const wallInTz = Date.UTC(p("year"), p("month") - 1, p("day"), p("hour") === 24 ? 0 : p("hour"), p("minute"), p("second"));

  // The difference tells us the timezone offset at that moment
  const offset = wallInTz - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}

function formatEventDescription(
  formData: Record<string, string>,
  pageTitle: string
): string {
  const lines = [`Booking: ${pageTitle}`];
  for (const [key, value] of Object.entries(formData)) {
    if (value) {
      lines.push("", `${key}: ${value}`);
    }
  }
  lines.push("", "", "Booked via SalesHub");
  return lines.join("\n");
}

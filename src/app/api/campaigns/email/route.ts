import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEmailCampaignSchema } from "@/lib/validations";
import type { EmailCampaignWithStats, EmailCampaign, EmailSendStatus, AudienceFilter } from "@/types/campaigns";
import { enrollEmailAudience, getEmailAudienceContactIds } from "@/lib/campaigns/email-audience";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const params = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(params.get("page") ?? "1"));
  const ALLOWED_PER_PAGE = [10, 25, 50, 100];
  const parsedPerPage = parseInt(params.get("per_page") ?? "25");
  const perPage = ALLOWED_PER_PAGE.includes(parsedPerPage) ? parsedPerPage : 25;
  const search = params.get("search")?.trim() ?? "";
  const status = params.get("status") ?? "";
  const type = params.get("type") ?? "";
  const sort = params.get("sort") ?? "created_at";
  const order = params.get("order") ?? "desc";

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("email_campaigns")
    .select("*", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (search) query = query.ilike("name", `%${search}%`);

  const ascending = order === "asc";
  query = query.order(sort, { ascending }).range(from, to);

  const { data: campaigns, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  const campaignList = (campaigns ?? []) as EmailCampaign[];

  const campaignIds = campaignList.map((c) => c.id);
  let campaignsWithStats: EmailCampaignWithStats[] = campaignList.map((c) => ({
    ...c,
    step_count: 0,
    recipient_count: 0,
    sent_count: 0,
    opened_count: 0,
    clicked_count: 0,
    bounced_count: 0,
    failed_count: 0,
  }));

  if (campaignIds.length > 0) {
    const { data: steps } = await supabase
      .from("email_steps")
      .select("campaign_id")
      .in("campaign_id", campaignIds);

    const stepCountMap: Record<string, number> = {};
    if (steps) {
      for (const s of steps) {
        stepCountMap[s.campaign_id] = (stepCountMap[s.campaign_id] ?? 0) + 1;
      }
    }

    const { data: sends } = await supabase
      .from("email_sends")
      .select("campaign_id, status")
      .in("campaign_id", campaignIds);

    const sendStatsMap: Record<string, {
      recipient_count: number;
      sent_count: number;
      opened_count: number;
      clicked_count: number;
      bounced_count: number;
      failed_count: number;
    }> = {};

    if (sends) {
      for (const s of sends) {
        const cid = s.campaign_id;
        if (!cid) continue;
        if (!sendStatsMap[cid]) {
          sendStatsMap[cid] = {
            recipient_count: 0,
            sent_count: 0,
            opened_count: 0,
            clicked_count: 0,
            bounced_count: 0,
            failed_count: 0,
          };
        }
        const stats = sendStatsMap[cid];
        stats.recipient_count++;
        const sendStatus = s.status as EmailSendStatus;
        if (sendStatus === "sent" || sendStatus === "delivered" || sendStatus === "opened" || sendStatus === "clicked") {
          stats.sent_count++;
        }
        if (sendStatus === "opened" || sendStatus === "clicked") {
          stats.opened_count++;
        }
        if (sendStatus === "clicked") {
          stats.clicked_count++;
        }
        if (sendStatus === "bounced") {
          stats.bounced_count++;
        }
        if (sendStatus === "failed") {
          stats.failed_count++;
        }
      }
    }

    campaignsWithStats = campaignList.map((c) => ({
      ...c,
      step_count: stepCountMap[c.id] ?? 0,
      recipient_count: sendStatsMap[c.id]?.recipient_count ?? 0,
      sent_count: sendStatsMap[c.id]?.sent_count ?? 0,
      opened_count: sendStatsMap[c.id]?.opened_count ?? 0,
      clicked_count: sendStatsMap[c.id]?.clicked_count ?? 0,
      bounced_count: sendStatsMap[c.id]?.bounced_count ?? 0,
      failed_count: sendStatsMap[c.id]?.failed_count ?? 0,
    }));
  }

  return NextResponse.json({
    data: campaignsWithStats,
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createEmailCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, type, audience_filter, steps, activate } = parsed.data;

  const { data: campaign, error: campaignError } = await supabase
    .from("email_campaigns")
    .insert({
      name,
      type,
      status: "draft" as const,
      audience_filter: audience_filter ?? null,
    })
    .select()
    .single();

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }

  const stepRows = steps.map((s) => ({
    campaign_id: campaign.id,
    order: s.order,
    subject: s.subject,
    preview_text: s.preview_text ?? null,
    body_html: s.body_html,
    delay_hours: s.delay_hours,
    condition: s.condition ?? null,
  }));

  const { error: stepsError } = await supabase
    .from("email_steps")
    .insert(stepRows);

  if (stepsError) {
    await supabase.from("email_campaigns").delete().eq("id", campaign.id);
    return NextResponse.json({ error: stepsError.message }, { status: 500 });
  }

  if (activate) {
    await supabase
      .from("email_campaigns")
      .update({ status: "active" as const })
      .eq("id", campaign.id);

    // For one-time/newsletter: queue email_sends for all audience contacts
    // For drip: enroll contacts into drip sequence
    if (type === "drip") {
      await enrollEmailAudience(campaign.id, audience_filter ?? null);
    } else {
      // Get first step to link sends
      const { data: firstStep } = await supabase
        .from("email_steps")
        .select("id")
        .eq("campaign_id", campaign.id)
        .order("order", { ascending: true })
        .limit(1)
        .single();

      if (firstStep) {
        const contactIds = await getEmailAudienceContactIds(audience_filter ?? null);
        if (contactIds.length > 0) {
          const sendRows = contactIds.map((contactId) => ({
            campaign_id: campaign.id,
            step_id: firstStep.id,
            contact_id: contactId,
            status: "queued" as const,
          }));
          await supabase.from("email_sends").insert(sendRows);
        }
      }
    }
  }

  return NextResponse.json(campaign, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
  }
  if (typeof body.status === "string") {
    const validStatuses = ["draft", "active", "paused", "completed"];
    if (validStatuses.includes(body.status)) {
      update.status = body.status;
    }
  }
  if (body.audience_filter !== undefined) {
    update.audience_filter = body.audience_filter;
  }

  // Extract steps array for separate handling
  const stepsToUpdate = Array.isArray(body.steps) ? body.steps as {
    id: string;
    subject?: string;
    preview_text?: string;
    body_html?: string;
    delay_hours?: number;
  }[] : null;

  if (Object.keys(update).length === 0 && !stepsToUpdate) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("email_campaigns")
    .select("status, type, audience_filter")
    .eq("id", id)
    .single();

  let data: Record<string, unknown> | null = null;
  let error: { message: string } | null = null;

  if (Object.keys(update).length > 0) {
    const result = await supabase
      .from("email_campaigns")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    data = result.data;
    error = result.error;
  } else {
    // No campaign-level updates, just fetch current data
    const result = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", id)
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update steps if provided (only allowed for draft/paused campaigns)
  if (stepsToUpdate && stepsToUpdate.length > 0) {
    const editableStatuses = ["draft", "paused"];
    const currentStatus = (update.status as string) ?? existing?.status;
    if (!editableStatuses.includes(currentStatus ?? "")) {
      return NextResponse.json(
        { error: "Steps can only be edited for draft or paused campaigns" },
        { status: 400 }
      );
    }

    for (const step of stepsToUpdate) {
      if (!step.id) continue;
      const stepUpdate: Record<string, unknown> = {};
      if (typeof step.subject === "string") stepUpdate.subject = step.subject;
      if (typeof step.preview_text === "string") stepUpdate.preview_text = step.preview_text;
      if (typeof step.body_html === "string") stepUpdate.body_html = step.body_html;
      if (typeof step.delay_hours === "number") stepUpdate.delay_hours = step.delay_hours;

      if (Object.keys(stepUpdate).length > 0) {
        await supabase
          .from("email_steps")
          .update(stepUpdate)
          .eq("id", step.id)
          .eq("campaign_id", id);
      }
    }
  }

  // Auto-enroll/queue when a campaign is activated
  if (
    update.status === "active" &&
    existing &&
    existing.status !== "active"
  ) {
    const filter = existing.audience_filter as AudienceFilter | null;

    if (existing.type === "drip") {
      const enrolled = await enrollEmailAudience(id, filter);
      return NextResponse.json({ ...data, enrolled });
    } else {
      // One-time / newsletter: queue email_sends
      const { data: firstStep } = await supabase
        .from("email_steps")
        .select("id")
        .eq("campaign_id", id)
        .order("order", { ascending: true })
        .limit(1)
        .single();

      if (firstStep) {
        const contactIds = await getEmailAudienceContactIds(filter);
        if (contactIds.length > 0) {
          const sendRows = contactIds.map((contactId) => ({
            campaign_id: id,
            step_id: firstStep.id,
            contact_id: contactId,
            status: "queued" as const,
          }));
          await supabase.from("email_sends").insert(sendRows);
        }
        return NextResponse.json({ ...data, queued: contactIds.length });
      }
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
  }

  await supabase.from("email_sends").delete().eq("campaign_id", id);
  await supabase.from("email_steps").delete().eq("campaign_id", id);

  const { error } = await supabase
    .from("email_campaigns")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { EmailCampaign, EmailCampaignWithStats, EmailSendStatus } from "@/types/campaigns";
import { EmailCampaignList } from "@/components/communication/email-campaign-list";

export default async function EmailCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(params.page ?? "1"));
  const ALLOWED_PER_PAGE = [10, 25, 50, 100];
  const parsedPerPage = parseInt(params.per_page ?? "25");
  const perPage = ALLOWED_PER_PAGE.includes(parsedPerPage) ? parsedPerPage : 25;
  const search = params.search?.trim() ?? "";
  const status = params.status ?? "";
  const type = params.type ?? "";
  const sort = params.sort ?? "created_at";
  const order = params.order ?? "desc";

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

  const { data: campaigns, count } = await query;

  const campaignList = (campaigns ?? []) as EmailCampaign[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

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
    const [stepsResult, sendsResult] = await Promise.all([
      supabase
        .from("email_steps")
        .select("campaign_id")
        .in("campaign_id", campaignIds),
      supabase
        .from("email_sends")
        .select("campaign_id, status")
        .in("campaign_id", campaignIds),
    ]);

    const stepCountMap: Record<string, number> = {};
    if (stepsResult.data) {
      for (const s of stepsResult.data) {
        stepCountMap[s.campaign_id] = (stepCountMap[s.campaign_id] ?? 0) + 1;
      }
    }

    const sendStatsMap: Record<string, {
      recipient_count: number;
      sent_count: number;
      opened_count: number;
      clicked_count: number;
      bounced_count: number;
      failed_count: number;
    }> = {};

    if (sendsResult.data) {
      for (const s of sendsResult.data) {
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

  return (
    <Suspense>
      <EmailCampaignList
        campaigns={campaignsWithStats}
        total={total}
        page={page}
        perPage={perPage}
        totalPages={totalPages}
      />
    </Suspense>
  );
}

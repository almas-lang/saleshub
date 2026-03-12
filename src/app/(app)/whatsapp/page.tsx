import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { WACampaign, WACampaignWithStats, WASendStatus } from "@/types/campaigns";
import { WACampaignList } from "@/components/communication/wa-campaign-list";

export default async function WhatsAppCampaignsPage({
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

  // Build campaigns query
  let query = supabase
    .from("wa_campaigns")
    .select("*", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (search) query = query.ilike("name", `%${search}%`);

  const ascending = order === "asc";
  query = query.order(sort, { ascending }).range(from, to);

  const { data: campaigns, count } = await query;

  const campaignList = (campaigns ?? []) as WACampaign[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // Fetch step counts + send stats in parallel for the returned campaigns
  const campaignIds = campaignList.map((c) => c.id);

  let campaignsWithStats: WACampaignWithStats[] = campaignList.map((c) => ({
    ...c,
    step_count: 0,
    recipient_count: 0,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
  }));

  if (campaignIds.length > 0) {
    const [stepsResult, sendsResult] = await Promise.all([
      supabase
        .from("wa_steps")
        .select("campaign_id")
        .in("campaign_id", campaignIds),
      supabase
        .from("wa_sends")
        .select("campaign_id, status")
        .in("campaign_id", campaignIds),
    ]);

    // Step counts per campaign
    const stepCountMap: Record<string, number> = {};
    if (stepsResult.data) {
      for (const s of stepsResult.data) {
        stepCountMap[s.campaign_id] = (stepCountMap[s.campaign_id] ?? 0) + 1;
      }
    }

    // Send stats per campaign
    const sendStatsMap: Record<string, {
      recipient_count: number;
      sent_count: number;
      delivered_count: number;
      read_count: number;
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
            delivered_count: 0,
            read_count: 0,
            failed_count: 0,
          };
        }
        const stats = sendStatsMap[cid];
        stats.recipient_count++;
        const sendStatus = s.status as WASendStatus;
        if (sendStatus === "sent" || sendStatus === "delivered" || sendStatus === "read") {
          stats.sent_count++;
        }
        if (sendStatus === "delivered" || sendStatus === "read") {
          stats.delivered_count++;
        }
        if (sendStatus === "read") {
          stats.read_count++;
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
      delivered_count: sendStatsMap[c.id]?.delivered_count ?? 0,
      read_count: sendStatsMap[c.id]?.read_count ?? 0,
      failed_count: sendStatsMap[c.id]?.failed_count ?? 0,
    }));
  }

  return (
    <Suspense>
      <WACampaignList
        campaigns={campaignsWithStats}
        total={total}
        page={page}
        perPage={perPage}
        totalPages={totalPages}
      />
    </Suspense>
  );
}

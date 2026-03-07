import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetBreadcrumb } from "@/components/layout/breadcrumb-context";
import { CampaignDetail } from "@/components/communication/campaign-detail";
import type { WACampaign, WAStep, WASendStatus, AudienceFilter } from "@/types/campaigns";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Parallel fetches
  const [campaignRes, stepsRes, sendsRes, funnelsRes, membersRes] =
    await Promise.all([
      supabase.from("wa_campaigns").select("*").eq("id", id).single(),
      supabase
        .from("wa_steps")
        .select("*")
        .eq("campaign_id", id)
        .order("order"),
      supabase
        .from("wa_sends")
        .select("*, contacts(id, first_name, last_name, phone)")
        .eq("campaign_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("funnels")
        .select("id, name, funnel_stages(id, name)"),
      supabase.from("team_members").select("id, name"),
    ]);

  if (campaignRes.error || !campaignRes.data) {
    notFound();
  }

  const campaign = campaignRes.data as WACampaign;
  const steps = (stepsRes.data ?? []) as WAStep[];
  const sends = (sendsRes.data ?? []) as Array<{
    id: string;
    contact_id: string;
    status: WASendStatus;
    sent_at: string | null;
    delivered_at: string | null;
    read_at: string | null;
    contacts: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      phone: string;
    } | null;
  }>;

  // Compute send stats server-side
  let recipientCount = 0;
  let sentCount = 0;
  let deliveredCount = 0;
  let readCount = 0;
  let failedCount = 0;

  for (const s of sends) {
    recipientCount++;
    const status = s.status as WASendStatus;
    if (status === "sent" || status === "delivered" || status === "read") {
      sentCount++;
    }
    if (status === "delivered" || status === "read") {
      deliveredCount++;
    }
    if (status === "read") {
      readCount++;
    }
    if (status === "failed") {
      failedCount++;
    }
  }

  // Build lookup maps for audience filter labels
  const funnelMap: Record<string, string> = {};
  const stageMap: Record<string, string> = {};
  for (const f of funnelsRes.data ?? []) {
    funnelMap[f.id] = f.name;
    for (const s of (f.funnel_stages as { id: string; name: string }[]) ?? []) {
      stageMap[s.id] = s.name;
    }
  }

  const memberMap: Record<string, string> = {};
  for (const m of membersRes.data ?? []) {
    memberMap[m.id] = m.name;
  }

  return (
    <>
      <SetBreadcrumb
        items={[
          { label: "WhatsApp", href: "/whatsapp" },
          { label: campaign.name },
        ]}
      />
      <CampaignDetail
        campaign={campaign}
        steps={steps}
        sends={sends}
        stats={{
          recipient_count: recipientCount,
          sent_count: sentCount,
          delivered_count: deliveredCount,
          read_count: readCount,
          failed_count: failedCount,
        }}
        lookups={{ funnelMap, stageMap, memberMap }}
      />
    </>
  );
}

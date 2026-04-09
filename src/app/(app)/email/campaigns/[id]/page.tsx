import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetBreadcrumb } from "@/components/layout/breadcrumb-context";
import { EmailCampaignDetail } from "@/components/communication/email-campaign-detail";
import type { EmailCampaign, EmailStep, EmailSendStatus, AudienceFilter } from "@/types/campaigns";

export default async function EmailCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [campaignRes, stepsRes, sendsRes, funnelsRes, membersRes] =
    await Promise.all([
      supabase.from("email_campaigns").select("*").eq("id", id).single(),
      supabase
        .from("email_steps")
        .select("*")
        .eq("campaign_id", id)
        .order("order"),
      supabase
        .from("email_sends")
        .select("*, contacts(id, first_name, last_name, email)")
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

  const campaign = campaignRes.data as EmailCampaign;
  const steps = (stepsRes.data ?? []) as EmailStep[];
  const sends = (sendsRes.data ?? []) as Array<{
    id: string;
    contact_id: string;
    step_id: string | null;
    status: EmailSendStatus;
    sent_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    contacts: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string;
    } | null;
  }>;

  // Compute send stats server-side
  let recipientCount = 0;
  let sentCount = 0;
  let openedCount = 0;
  let clickedCount = 0;
  let failedCount = 0;

  for (const s of sends) {
    recipientCount++;
    const status = s.status as EmailSendStatus;
    if (status === "sent" || status === "delivered" || status === "opened" || status === "clicked") {
      sentCount++;
    }
    if (status === "opened" || status === "clicked") {
      openedCount++;
    }
    if (status === "clicked") {
      clickedCount++;
    }
    if (status === "failed") {
      failedCount++;
    }
  }

  // Build lookup maps
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
          { label: "Email", href: "/email" },
          { label: campaign.name },
        ]}
      />
      <EmailCampaignDetail
        campaign={campaign}
        steps={steps}
        sends={sends}
        stats={{
          recipient_count: recipientCount,
          sent_count: sentCount,
          opened_count: openedCount,
          clicked_count: clickedCount,
          failed_count: failedCount,
        }}
        lookups={{ funnelMap, stageMap, memberMap }}
      />
    </>
  );
}

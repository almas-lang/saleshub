import { createClient } from "@/lib/supabase/server";
import { UnifiedCampaignListClient } from "@/components/communication/unified-campaign-list";

export default async function CampaignsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: campaigns, error } = await supabase
    .from("unified_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Unified drip sequences mixing WhatsApp and Email in a single flow.
        </p>
      </div>

      <UnifiedCampaignListClient
        campaigns={error ? [] : (campaigns ?? [])}
      />
    </div>
  );
}

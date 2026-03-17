import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IntegrationsSettings } from "@/components/settings/integrations-settings";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Look up team member for connection status
  let connected = false;

  let { data: member } = await supabase
    .from("team_members")
    .select("google_calendar_connected")
    .eq("auth_user_id", user.id)
    .single();

  if (!member && user.email) {
    const { data: byEmail } = await supabase
      .from("team_members")
      .select("google_calendar_connected")
      .eq("email", user.email)
      .single();
    member = byEmail;
  }

  if (member) {
    connected = member.google_calendar_connected ?? false;
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Settings
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Connect external services to SalesHub.
        </p>
      </div>

      <IntegrationsSettings
        initialConnected={connected}
        whatsappDisplay={process.env.WHATSAPP_PHONE_DISPLAY || ""}
        emailDomain={process.env.RESEND_DOMAIN || ""}
        cashfreeConfigured={!!process.env.CASHFREE_APP_ID}
        stripeConfigured={!!process.env.STRIPE_SECRET_KEY}
        metaAdsConfigured={!!process.env.META_ADS_ACCESS_TOKEN}
      />
    </div>
  );
}

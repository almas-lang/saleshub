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
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Connect external services to SalesHub.
        </p>
      </div>

      <IntegrationsSettings initialConnected={connected} />
    </div>
  );
}

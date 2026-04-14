import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AppShell } from "@/components/layout/app-shell";
import { CalendarDisconnectAlert } from "@/components/calendar-disconnect-alert";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: disconnected } = await supabaseAdmin
    .from("team_members")
    .select("id, name, email")
    .eq("is_active", true)
    .eq("google_calendar_connected", false)
    .not("google_refresh_token", "is", null);

  return (
    <AppShell userEmail={user.email ?? ""}>
      <CalendarDisconnectAlert members={disconnected ?? []} />
      {children}
    </AppShell>
  );
}

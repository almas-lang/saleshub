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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("id, name, email, google_disconnect_reason, google_disconnected_at" as any)
    .eq("is_active", true)
    .eq("google_calendar_connected", false)
    .not("google_refresh_token", "is", null);

  type DisconnectedRow = {
    id: string;
    name: string | null;
    email: string;
    google_disconnect_reason: string | null;
    google_disconnected_at: string | null;
  };

  return (
    <AppShell userEmail={user.email ?? ""}>
      <CalendarDisconnectAlert members={(disconnected as unknown as DisconnectedRow[]) ?? []} />
      {children}
    </AppShell>
  );
}

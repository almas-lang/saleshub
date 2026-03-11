import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConnectCalendarList } from "@/components/settings/connect-calendar-list";

export default async function ConnectCalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: members } = await supabase
    .from("team_members")
    .select("id, name, email, google_calendar_connected")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Connect Google Calendar
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Connect Google Calendar for any team member. Sign into the correct
          Google account when the OAuth popup opens.
        </p>
      </div>
      <ConnectCalendarList members={members ?? []} />
    </div>
  );
}

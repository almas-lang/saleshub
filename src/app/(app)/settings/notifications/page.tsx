import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificationPreferences } from "@/components/settings/notification-preferences";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Resolve team member preferences
  let preferences: Record<string, boolean> = {};

  let member = null;
  const { data: byAuth } = await supabase
    .from("team_members")
    .select("notification_preferences")
    .eq("auth_user_id", user.id)
    .single();

  if (byAuth) {
    member = byAuth;
  } else if (user.email) {
    const { data: byEmail } = await supabase
      .from("team_members")
      .select("notification_preferences")
      .eq("email", user.email)
      .single();
    member = byEmail;
  }

  if (member?.notification_preferences) {
    preferences = member.notification_preferences as Record<string, boolean>;
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
        <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose which notifications you want to receive.
        </p>
      </div>

      <NotificationPreferences initialPreferences={preferences} />
    </div>
  );
}

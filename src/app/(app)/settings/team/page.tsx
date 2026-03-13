import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TeamList } from "@/components/settings/team-list";

export default async function TeamManagementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: members } = await supabase
    .from("team_members")
    .select(
      "id, name, email, phone, role, is_active, google_calendar_connected"
    )
    .order("created_at", { ascending: true });

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
        <h1 className="text-xl font-semibold tracking-tight">
          Team Management
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Add, edit, and manage team members and their roles.
        </p>
      </div>

      <TeamList members={members ?? []} />
    </div>
  );
}

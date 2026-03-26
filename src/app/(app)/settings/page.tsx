import { createClient } from "@/lib/supabase/server";
import { SettingsHub } from "@/components/settings/settings-hub";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { name: string; email: string; role: string } | null = null;

  if (user) {
    const { data } = await supabase
      .from("team_members")
      .select("name, email, role")
      .eq("email", user.email!)
      .single();

    profile = data;
  }

  return (
    <SettingsHub
      userName={profile?.name ?? user?.email ?? ""}
      userEmail={profile?.email ?? user?.email ?? ""}
      userRole={profile?.role ?? "admin"}
    />
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";

export default async function BusinessProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .single();

  const defaults = data ?? {
    business_name: "",
    gst_number: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pincode: "",
    support_email: "",
    default_sender_name: "Xperience Wave",
    logo_url: "",
  };

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
          Business Profile
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your company details and branding.
        </p>
      </div>

      <BusinessProfileForm initialData={defaults} />
    </div>
  );
}

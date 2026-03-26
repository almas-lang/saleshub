import { createClient } from "@/lib/supabase/server";
import type { EmailTemplate } from "@/types/email-templates";
import { EmailTemplateGrid } from "@/components/communication/email-template-grid";

export default async function EmailTemplatesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  const templates: EmailTemplate[] = data ?? [];

  return (
    <div className="page-enter space-y-6">
      <EmailTemplateGrid templates={templates} />
    </div>
  );
}

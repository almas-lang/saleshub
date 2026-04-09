import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EmailTemplate } from "@/types/email-templates";
import { EmailTemplateEditorPage } from "@/components/communication/email-template-editor-page";

export default async function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const template: EmailTemplate = data;

  return <EmailTemplateEditorPage template={template} />;
}

import { getTemplates } from "@/lib/whatsapp/client";
import { TemplateList } from "./template-list";

export default async function WhatsAppTemplatesPage() {
  const result = await getTemplates();
  const templates = result.success ? (result.templates ?? []) : [];
  const fetchError = result.success ? null : result.error;

  return (
    <TemplateList templates={templates} fetchError={fetchError ?? null} />
  );
}

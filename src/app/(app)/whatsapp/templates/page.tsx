import { getTemplates } from "@/lib/whatsapp/client";
import { TemplateList } from "./template-list";

export default async function WhatsAppTemplatesPage() {
  const result = await getTemplates();
  const templates = result.success ? (result.templates ?? []) : [];
  const fetchError = result.success ? null : result.error;

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          WhatsApp Templates
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Approved message templates from Meta Business Manager.
        </p>
      </div>

      <TemplateList templates={templates} fetchError={fetchError ?? null} />
    </div>
  );
}

import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types";

export type EmailTemplate = Tables<"email_templates">;
export type EmailTemplateInsert = TablesInsert<"email_templates">;
export type EmailTemplateUpdate = TablesUpdate<"email_templates">;

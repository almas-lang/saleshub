import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getTemplates, createTemplate, deleteTemplate } from "@/lib/whatsapp/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTemplates();

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Failed to fetch templates" },
      { status: 502 }
    );
  }

  return NextResponse.json({ templates: result.templates ?? [] });
}

const createTemplateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores"),
  category: z.enum(["MARKETING", "UTILITY"]),
  language: z.string().default("en_US"),
  header: z.object({
    format: z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"]),
    text: z.string().max(60).optional(),
  }).optional(),
  body: z.string().min(1).max(1024),
  footer: z.string().max(60).optional(),
  buttons: z.array(z.object({
    type: z.enum(["URL", "PHONE_NUMBER", "QUICK_REPLY"]),
    text: z.string().min(1).max(25),
    url: z.string().url().optional(),
    phone_number: z.string().optional(),
  })).max(3).optional(),
  body_examples: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, category, language, header, body: bodyText, footer, buttons, body_examples } = parsed.data;

  const result = await createTemplate({
    name,
    category,
    language,
    header: header || undefined,
    body: bodyText,
    footer: footer || undefined,
    buttons: buttons || undefined,
    bodyExamples: body_examples || undefined,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Failed to create template" },
      { status: 502 },
    );
  }

  return NextResponse.json({ id: result.id, status: "PENDING" }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templateName = request.nextUrl.searchParams.get("name");
  if (!templateName) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }

  const result = await deleteTemplate(templateName);
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Failed to delete template" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTemplates } from "@/lib/whatsapp/client";

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

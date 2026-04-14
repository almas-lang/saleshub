import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: page, error: fetchErr } = await supabase
    .from("booking_pages")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !page) {
    return NextResponse.json(
      { error: fetchErr?.message ?? "Not found" },
      { status: fetchErr?.code === "PGRST116" ? 404 : 500 }
    );
  }

  const { data: existing } = await supabase
    .from("booking_pages")
    .select("slug")
    .like("slug", `${page.slug}-copy%`);

  const usedSlugs = new Set((existing ?? []).map((p) => p.slug));
  let newSlug = `${page.slug}-copy`;
  let n = 2;
  while (usedSlugs.has(newSlug)) {
    newSlug = `${page.slug}-copy-${n++}`;
  }

  const {
    id: _id,
    created_at: _created,
    updated_at: _updated,
    ...rest
  } = page as Record<string, unknown> & { id: string; created_at?: string; updated_at?: string };
  void _id;
  void _created;
  void _updated;

  const insertData = {
    ...rest,
    title: `${page.title} (Copy)`,
    slug: newSlug,
    is_active: false,
  };

  const { data, error } = await supabase
    .from("booking_pages")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

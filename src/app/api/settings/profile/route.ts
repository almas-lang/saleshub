import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { businessProfileSchema } from "@/lib/validations";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = businessProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Get existing row id
  const { data: existing } = await supabase
    .from("business_settings")
    .select("id")
    .limit(1)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: "Business settings not found. Please create the table first." },
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from("business_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

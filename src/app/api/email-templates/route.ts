import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailTemplateSchema } from "@/lib/validations";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = emailTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formFieldSchema } from "@/lib/validations";

// A saved library question is a FormField without its page-local id/sectionId —
// those are reassigned when the question is re-added to a booking page.
const libraryFieldSchema = formFieldSchema.omit({ id: true, sectionId: true });

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("form_field_library")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = libraryFieldSchema.safeParse(body?.field);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Resolve the team member to attribute the saved question (best-effort).
  let createdBy: string | null = null;
  const { data: byAuth } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (byAuth) {
    createdBy = byAuth.id;
  } else if (user.email) {
    const { data: byEmail } = await supabase
      .from("team_members")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    createdBy = byEmail?.id ?? null;
  }

  const { data, error } = await supabase
    .from("form_field_library")
    .insert({ field: parsed.data, created_by: createdBy })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

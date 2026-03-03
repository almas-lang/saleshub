import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { activitySchema } from "@/lib/validations";

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = activitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("activities")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

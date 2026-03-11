import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookingPageSchema } from "@/lib/validations";
import { DEFAULT_BOOKING_FORM_FIELDS, DEFAULT_AVAILABILITY_RULES } from "@/lib/constants";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booking_pages")
    .select("*, bookings(count)")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pages = data.map((p) => ({
    ...p,
    booking_count: (p.bookings as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  return NextResponse.json(pages);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = bookingPageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Check slug uniqueness
  const { count } = await supabase
    .from("booking_pages")
    .select("*", { count: "exact", head: true })
    .eq("slug", parsed.data.slug);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "A booking page with this slug already exists" },
      { status: 409 }
    );
  }

  // Apply defaults for form_fields and availability_rules if not provided
  const insertData = {
    ...parsed.data,
    form_fields: parsed.data.form_fields ?? DEFAULT_BOOKING_FORM_FIELDS,
    availability_rules: parsed.data.availability_rules ?? DEFAULT_AVAILABILITY_RULES,
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

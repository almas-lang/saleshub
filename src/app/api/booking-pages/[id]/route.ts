import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookingPageSchema } from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booking_pages")
    .select("*, bookings(count)")
    .eq("id", id)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({
    ...data,
    booking_count: (data.bookings as unknown as { count: number }[])?.[0]?.count ?? 0,
  });
}

const patchSchema = bookingPageSchema.partial();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Check slug uniqueness if slug is being updated
  if (parsed.data.slug) {
    const { count } = await supabase
      .from("booking_pages")
      .select("*", { count: "exact", head: true })
      .eq("slug", parsed.data.slug)
      .neq("id", id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: "A booking page with this slug already exists" },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabase
    .from("booking_pages")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Soft-delete (deactivate) if bookings exist, hard-delete otherwise
  const { count } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("booking_page_id", id);

  const hasBookings = count && count > 0;

  const { error } = hasBookings
    ? await supabase.from("booking_pages").update({ is_active: false }).eq("id", id)
    : await supabase.from("booking_pages").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

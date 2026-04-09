import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enrollContactByTrigger } from "@/lib/campaigns/trigger-enroll";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const update: Record<string, unknown> = {};
  if (body.status) update.status = body.status;
  if (body.outcome) update.outcome = body.outcome;
  if (body.notes !== undefined) update.notes = body.notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", id)
    .select("*, contacts(id)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger campaign enrollment based on booking status change
  if (body.status && data.contacts) {
    const contactId = (data.contacts as { id: string }).id;
    const triggerMap: Record<string, string> = {
      confirmed: "booking_confirmed",
      no_show: "booking_no_show",
      completed: "booking_completed",
      cancelled: "booking_cancelled",
    };
    const triggerEvent = triggerMap[body.status];
    if (triggerEvent && contactId) {
      await enrollContactByTrigger(contactId, triggerEvent).catch(() => {});
    }
  }

  return NextResponse.json(data);
}

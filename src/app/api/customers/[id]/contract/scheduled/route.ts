import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const [scheduledRes, lastSentRes] = await Promise.all([
    supabase
      .from("contract_sends")
      .select("id, sent_to_name, sent_to_email, scheduled_at, status")
      .eq("contact_id", id)
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("contract_sends")
      .select("id, sent_to_name, sent_to_email, sent_at, status")
      .eq("contact_id", id)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (scheduledRes.error) {
    return NextResponse.json({ error: scheduledRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    scheduled: scheduledRes.data ?? [],
    last_sent: lastSentRes.data ?? null,
  });
}

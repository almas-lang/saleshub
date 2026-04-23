import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; sendId: string }> }
) {
  const { id, sendId } = await params;
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("contract_sends")
    .select("id, status, resend_message_id, contact_id")
    .eq("id", sendId)
    .eq("contact_id", id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Scheduled contract not found" }, { status: 404 });
  }

  if (row.status !== "scheduled") {
    return NextResponse.json(
      { error: `Cannot cancel — current status is ${row.status}` },
      { status: 400 }
    );
  }

  if (row.resend_message_id) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.cancel(row.resend_message_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { error: `Resend cancel failed: ${message}` },
        { status: 500 }
      );
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("contract_sends")
    .update({ status: "cancelled" })
    .eq("id", sendId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

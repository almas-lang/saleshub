import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderContractEmail } from "@/lib/contracts/email-template";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone")
    .eq("id", id)
    .single();

  if (error || !contact) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  let overrides: { name?: string; email?: string; phone?: string } = {};
  try {
    overrides = await request.json();
  } catch {
    // empty body is fine; fall back to contact defaults
  }

  const name =
    overrides.name?.trim() ||
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

  const { subject, html } = renderContractEmail({ name });

  return NextResponse.json({ subject, html });
}

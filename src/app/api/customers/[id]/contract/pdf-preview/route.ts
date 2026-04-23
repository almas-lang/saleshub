import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fillContractPdf } from "@/lib/contracts/fill-contract";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("id", id)
    .single();

  if (error || !contact) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  let overrides: { name?: string; scheduled_at?: string | null } = {};
  try {
    overrides = await request.json();
  } catch {
    // empty body is fine
  }

  const name =
    overrides.name?.trim() ||
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

  let contractDate = new Date();
  if (overrides.scheduled_at) {
    const parsed = new Date(overrides.scheduled_at);
    if (!Number.isNaN(parsed.getTime())) {
      contractDate = parsed;
    }
  }

  try {
    const pdfBytes = await fillContractPdf({ name, sentAt: contractDate });
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"contract-preview.pdf\"",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to render contract PDF: ${message}` },
      { status: 500 }
    );
  }
}

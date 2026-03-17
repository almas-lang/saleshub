import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bankImportBatchSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const parsed = bankImportBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { rows, config } = parsed.data;

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  const toInsert = rows.filter((row) => {
    if (config.skip_zero_amounts && row.amount === 0) {
      skipped++;
      return false;
    }
    return true;
  });

  if (toInsert.length > 0) {
    const records = toInsert.map((row) => ({
      type: row.type as "income" | "expense",
      amount: row.amount,
      category: row.category,
      date: row.date,
      description: row.description || null,
      gst_applicable: row.gst_applicable,
      receipt_url: null,
      contact_id: null,
    }));

    const { data, error } = await supabase
      .from("transactions")
      .insert(records)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    inserted = data?.length ?? 0;
    const failedCount = toInsert.length - inserted;
    if (failedCount > 0) {
      errors.push(`${failedCount} rows failed to insert`);
    }
  }

  return NextResponse.json({ inserted, skipped, errors }, { status: 201 });
}

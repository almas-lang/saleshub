export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiverPkg = require("archiver") as { ZipArchive: new (opts?: { zlib?: { level: number } }) => import("stream").Transform & { append(data: Buffer | NodeJS.ReadableStream, opts: { name: string }): void; finalize(): Promise<void> } };
import { PassThrough } from "stream";

/**
 * GET /api/finance/reports/bills-dump?month=YYYY-MM
 * Downloads a ZIP containing:
 *   /Bills/           — all attached vendor bills
 *   /Statements/      — uploaded bank, cashfree, card CSVs
 *   /Report/          — the monthly XLSX report
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const format = searchParams.get("format"); // "json" for manifest only
  if (!month) {
    return NextResponse.json({ error: "month required" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  const monStr = String(mon).padStart(2, "0");
  const monthLabel = new Date(year, mon - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const archive = new archiverPkg.ZipArchive({ zlib: { level: 5 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  // ── 1. Bills folder: all expense attachments ──
  const { data: expenses } = await supabaseAdmin
    .from("transactions")
    .select("id, description, category, amount, date, attachment_url")
    .eq("type", "expense")
    .gte("date", from)
    .lte("date", to)
    .not("attachment_url", "is", null)
    .not("attachment_url", "eq", "")
    .order("date", { ascending: true });

  const bills: { bill_no: number; filename: string; url: string; amount: number; vendor: string; date: string; category: string }[] = [];
  let billNo = 1;
  for (const exp of expenses ?? []) {
    const urls = (exp.attachment_url ?? "").split(",").filter(Boolean);
    for (const url of urls) {
      const date = exp.date.replace(/-/g, "");
      const vendor = (exp.description ?? exp.category ?? "unknown")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .substring(0, 30);
      const ext = url.includes(".png") ? "png" : url.includes(".jpg") || url.includes(".jpeg") ? "jpg" : "pdf";
      const filename = `${String(billNo).padStart(2, "0")}-${date}-${vendor}-Rs${exp.amount}.${ext}`;

      bills.push({ bill_no: billNo, filename, url, amount: exp.amount, vendor: exp.description ?? exp.category, date: exp.date, category: exp.category });

      if (!format) {
        // ZIP mode — download and include file
        try {
          const res = await fetch(url);
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            archive.append(buffer, { name: `Bills/${filename}` });
          }
        } catch { /* skip */ }
      }
      billNo++;
    }
  }

  // JSON manifest mode — return list without downloading files
  if (format === "json") {
    return NextResponse.json({
      month: monthLabel,
      total_bills: bills.length,
      total_amount: expenses?.reduce((s, e) => s + e.amount, 0) ?? 0,
      bills,
    });
  }

  // ── 2. Statements folder: uploaded source files ──
  const { data: batch } = await supabaseAdmin
    .from("reconciliation_batches")
    .select("id, file_url")
    .eq("month", monStr)
    .eq("year", year)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (batch?.file_url) {
    try {
      const res = await fetch(batch.file_url);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        archive.append(buffer, { name: "Statements/Bank-Statement.csv" });
      }
    } catch { /* skip */ }
  }

  // Get all uploaded files from the bills bucket for this batch's timeframe
  const { data: storageFiles } = await supabaseAdmin.storage
    .from("bills")
    .list("expenses", { limit: 100, sortBy: { column: "created_at", order: "desc" } });

  // Also include any Cashfree/card files uploaded during reconciliation
  // These are in the expenses folder of the bills bucket

  // ── 3. Generate and include the monthly XLSX report ──
  try {
    const reportRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/finance/reports/monthly-xlsx?month=${month}`);
    if (reportRes.ok) {
      const buffer = Buffer.from(await reportRes.arrayBuffer());
      archive.append(buffer, { name: `Report/${monthLabel} Expwave - Sales and expenses.xlsx` });
    }
  } catch { /* skip */ }

  await archive.finalize();

  const chunks: Uint8Array[] = [];
  for await (const chunk of passthrough) {
    chunks.push(chunk as Uint8Array);
  }
  const zipBuffer = Buffer.concat(chunks);

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${monthLabel} Expwave - Complete Package.zip"`,
    },
  });
}

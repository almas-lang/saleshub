import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportToCSV, exportToXLSX } from "@/lib/finance/export";
import { format } from "date-fns";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, filters = {}, format: fmt = "csv" } = body;

  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  const supabase = await createClient();
  let rows: Record<string, unknown>[] = [];
  let filename = type;

  switch (type) {
    case "expenses": {
      let query = supabase
        .from("transactions")
        .select("date, category, description, amount, gst_applicable")
        .eq("type", "expense")
        .order("date", { ascending: false });

      if (filters.category) query = query.eq("category", filters.category);
      if (filters.from) query = query.gte("date", filters.from);
      if (filters.to) query = query.lte("date", filters.to);

      const { data } = await query.limit(1000);
      rows = (data ?? []).map((r) => ({
        Date: r.date,
        Category: r.category,
        Description: r.description ?? "",
        Amount: r.amount,
        GST: r.gst_applicable ? "Yes" : "No",
      }));
      filename = `expenses_${format(new Date(), "yyyy-MM-dd")}`;
      break;
    }

    case "ad_spend": {
      let query = supabase.from("ad_spend")
        .select("*")
        .order("date", { ascending: false });

      if (filters.platform) query = query.eq("platform", filters.platform);
      if (filters.from) query = query.gte("date", filters.from);
      if (filters.to) query = query.lte("date", filters.to);

      const { data } = await query.limit(1000);
      rows = (data ?? []).map((r) => ({
        Date: r.date,
        Platform: r.platform,
        Campaign: r.campaign_name,
        Spend: r.amount,
        Impressions: r.impressions,
        Clicks: r.clicks,
        Leads: r.leads,
        CPL: r.leads > 0 ? (r.amount / r.leads).toFixed(2) : "N/A",
      }));
      filename = `ad_spend_${format(new Date(), "yyyy-MM-dd")}`;
      break;
    }

    case "pnl": {
      if (!filters.from || !filters.to) {
        return NextResponse.json(
          { error: "from and to required for P&L export" },
          { status: 400 }
        );
      }

      const { data } = await supabase
        .from("transactions")
        .select("date, type, category, description, amount")
        .gte("date", filters.from)
        .lte("date", filters.to)
        .order("date", { ascending: true });

      rows = (data ?? []).map((r) => ({
        Date: r.date,
        Type: r.type,
        Category: r.category,
        Description: r.description ?? "",
        Amount: r.amount,
      }));
      filename = `pnl_${filters.from}_to_${filters.to}`;
      break;
    }

    case "gst": {
      if (!filters.from || !filters.to) {
        return NextResponse.json(
          { error: "from and to required for GST export" },
          { status: 400 }
        );
      }

      const { data } = await supabase
        .from("invoices")
        .select(
          "invoice_number, paid_at, total, gst_amount, customer_state"
        )
        .eq("status", "paid")
        .gte("paid_at", filters.from)
        .lte("paid_at", filters.to)
        .order("paid_at", { ascending: true });

      rows = (data ?? []).map((r) => {
        const isIntra =
          r.customer_state?.toLowerCase().trim() === "karnataka";
        const half = Math.round((r.gst_amount ?? 0) / 2);
        return {
          Invoice: r.invoice_number,
          "Paid At": r.paid_at ?? "",
          Total: r.total,
          "Customer State": r.customer_state ?? "",
          CGST: isIntra ? half : 0,
          SGST: isIntra ? (r.gst_amount ?? 0) - half : 0,
          IGST: isIntra ? 0 : r.gst_amount ?? 0,
        };
      });
      filename = `gst_${filters.from}_to_${filters.to}`;
      break;
    }

    case "revenue": {
      let query = supabase
        .from("invoices")
        .select(
          "invoice_number, total, paid_at, contacts(first_name, last_name)"
        )
        .eq("status", "paid")
        .not("paid_at", "is", null)
        .order("paid_at", { ascending: true });

      if (filters.from) query = query.gte("paid_at", filters.from);
      if (filters.to) query = query.lte("paid_at", filters.to);

      const { data } = await query.limit(1000);
      rows = (data ?? []).map((r) => {
        const contact = r.contacts as unknown as {
          first_name: string;
          last_name: string | null;
        } | null;
        return {
          Invoice: r.invoice_number,
          Customer: contact
            ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}`
            : "",
          Amount: r.total,
          "Paid At": r.paid_at ?? "",
        };
      });
      filename = `revenue_${format(new Date(), "yyyy-MM-dd")}`;
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No data to export" }, { status: 404 });
  }

  const result =
    fmt === "xlsx"
      ? await exportToXLSX(rows, filename)
      : exportToCSV(rows, filename);

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}

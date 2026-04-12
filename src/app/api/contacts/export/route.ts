import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EXPORT_COLUMNS: Record<string, { label: string; getter: (row: Record<string, unknown>) => string }> = {
  first_name: {
    label: "Name",
    getter: (r) => `${r.first_name ?? ""}${r.last_name ? ` ${r.last_name}` : ""}`.trim(),
  },
  email: { label: "Email", getter: (r) => String(r.email ?? "") },
  phone: { label: "Phone", getter: (r) => String(r.phone ?? "") },
  company_name: { label: "Company", getter: (r) => String(r.company_name ?? "") },
  source: { label: "Source", getter: (r) => String(r.source ?? "") },
  stage: {
    label: "Stage",
    getter: (r) => {
      const stage = r.funnel_stages as { name: string } | null;
      return stage?.name ?? "";
    },
  },
  funnel: {
    label: "Funnel",
    getter: (r) => {
      const funnel = r.funnels as { name: string } | null;
      return funnel?.name ?? "";
    },
  },
  assigned_to: {
    label: "Assigned To",
    getter: (r) => {
      const member = r.team_members as { name: string } | null;
      return member?.name ?? "";
    },
  },
  tags: {
    label: "Tags",
    getter: (r) => {
      const tags = r.tags as string[] | null;
      return tags?.join(", ") ?? "";
    },
  },
  created_at: {
    label: "Created",
    getter: (r) => {
      if (!r.created_at) return "";
      return new Date(r.created_at as string).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    },
  },
  linkedin_url: { label: "LinkedIn", getter: (r) => String(r.linkedin_url ?? "") },
  utm_source: { label: "UTM Source", getter: (r) => String(r.utm_source ?? "") },
  utm_medium: { label: "UTM Medium", getter: (r) => String(r.utm_medium ?? "") },
  utm_campaign: { label: "UTM Campaign", getter: (r) => String(r.utm_campaign ?? "") },
};

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  const {
    columns = ["first_name", "email", "phone"],
    contact_ids,
    filters,
  } = body as {
    columns?: string[];
    contact_ids?: string[];
    filters?: {
      tab?: string;
      search?: string;
      source?: string;
      funnel_id?: string;
      stage_id?: string;
      assigned_to?: string;
      booked?: string;
      tags?: string;
    };
  };

  // Validate columns
  const validColumns = columns.filter((c) => c in EXPORT_COLUMNS);
  if (validColumns.length === 0) {
    return NextResponse.json({ error: "No valid columns selected" }, { status: 400 });
  }

  // Build query — either specific IDs or filter-based
  let query = supabase
    .from("contacts")
    .select("*, funnel_stages(id, name, color), funnels(id, name), team_members(id, name)")
    .eq("type", "prospect")
    .is("deleted_at", null);

  if (contact_ids && contact_ids.length > 0) {
    // Export specific selected contacts
    query = query.in("id", contact_ids);
  } else if (filters) {
    // Export all matching the current filters
    const tab = filters.tab ?? "active";
    if (tab === "archived") {
      query = query.not("archived_at", "is", null);
    } else {
      query = query.is("archived_at", null);
    }

    if (filters.search) {
      const s = filters.search;
      query = query.or(
        `first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,company_name.ilike.%${s}%`
      );
    }

    if (filters.source) query = query.eq("source", filters.source);
    if (filters.funnel_id) query = query.eq("funnel_id", filters.funnel_id);
    if (filters.stage_id) query = query.eq("current_stage_id", filters.stage_id);
    if (filters.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
    if (filters.tags) {
      const tagList = filters.tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        query = query.overlaps("tags", tagList);
      }
    }

    // Handle booked filter
    if (filters.booked === "yes" || filters.booked === "no") {
      const { data: frData } = await supabase
        .from("contact_form_responses")
        .select("contact_id");
      const bookedIds = frData ? [...new Set(frData.map((r) => r.contact_id))] : [];

      if (filters.booked === "yes") {
        if (bookedIds.length === 0) {
          query = query.in("id", ["__no_match__"]);
        } else {
          query = query.in("id", bookedIds);
        }
      } else if (bookedIds.length > 0) {
        query = query.not("id", "in", `(${bookedIds.join(",")})`);
      }
    }
  } else {
    // Default: all active non-deleted prospects
    query = query.is("archived_at", null);
  }

  query = query.order("created_at", { ascending: false });

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "No prospects to export" }, { status: 404 });
  }

  // Build CSV
  const headerRow = validColumns.map((c) => escapeCsvField(EXPORT_COLUMNS[c].label));
  const csvLines = [headerRow.join(",")];

  for (const row of rows) {
    const line = validColumns.map((c) =>
      escapeCsvField(EXPORT_COLUMNS[c].getter(row as unknown as Record<string, unknown>))
    );
    csvLines.push(line.join(","));
  }

  const csv = csvLines.join("\n");
  const now = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prospects-${now}.csv"`,
    },
  });
}

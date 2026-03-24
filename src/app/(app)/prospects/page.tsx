import { Suspense } from "react";
import Link from "next/link";
import { List, Columns3, Archive, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ContactWithStage } from "@/types/contacts";
import { ProspectList } from "@/components/prospects/prospect-list";
import { ProspectKanban } from "@/components/prospects/prospect-kanban";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const tab = (params.tab ?? "active") as "active" | "archived";
  const view = params.view ?? "list";
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const ALLOWED_PER_PAGE = [10, 25, 50, 100];
  const parsedPerPage = parseInt(params.per_page ?? "25");
  const perPage = ALLOWED_PER_PAGE.includes(parsedPerPage) ? parsedPerPage : 25;
  const search = params.search?.trim() ?? "";
  const source = params.source ?? "";
  const funnelId = params.funnel_id ?? "";
  const stageId = params.stage_id ?? "";
  const assignedTo = params.assigned_to ?? "";
  const tags = params.tags ?? "";
  const booked = params.booked ?? "";
  const sort = params.sort ?? "created_at";
  const order = params.order ?? "desc";

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Pre-filter by booked status (check contact_form_responses)
  let bookedContactIds: string[] | null = null;

  if (booked === "yes" || booked === "no") {
    const { data: frData } = await supabase
      .from("contact_form_responses")
      .select("contact_id");

    const ids = frData ? [...new Set(frData.map((r) => r.contact_id))] : [];
    bookedContactIds = ids;
  }

  // Build contacts query
  let query = supabase
    .from("contacts")
    .select(
      "*, funnel_stages(id, name, color), funnels(id, name), team_members(id, name)",
      { count: "exact" }
    )
    .eq("type", "prospect")
    .is("deleted_at", null);

  // Archived tab filter
  if (tab === "archived") {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company_name.ilike.%${search}%`
    );
  }

  // Apply booked filter
  if (booked === "yes" && bookedContactIds !== null) {
    if (bookedContactIds.length === 0) {
      query = query.in("id", ["__no_match__"]);
    } else {
      query = query.in("id", bookedContactIds);
    }
  } else if (booked === "no" && bookedContactIds !== null) {
    if (bookedContactIds.length > 0) {
      query = query.not("id", "in", `(${bookedContactIds.join(",")})`);
    }
  }

  if (source) query = query.eq("source", source);
  if (funnelId) query = query.eq("funnel_id", funnelId);
  if (stageId) query = query.eq("current_stage_id", stageId);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (tagList.length > 0) {
      query = query.overlaps("tags", tagList);
    }
  }

  const ascending = order === "asc";

  // For kanban, fetch all contacts for the funnel (limit 500, no pagination)
  const isKanban = view === "kanban";
  if (!isKanban) {
    query = query.order(sort, { ascending }).range(from, to);
  } else {
    query = query.order("created_at", { ascending: false }).limit(500);
  }

  // Tab count queries
  const activeCountQuery = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("type", "prospect")
    .is("deleted_at", null)
    .is("archived_at", null);

  const archivedCountQuery = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("type", "prospect")
    .is("deleted_at", null)
    .not("archived_at", "is", null);

  // Fetch contacts + filter options + tab counts + booked IDs in parallel
  const [contactsResult, funnelsResult, membersResult, sourcesResult, activeCountResult, archivedCountResult, bookedResult] = await Promise.all([
    query,
    supabase
      .from("funnels")
      .select("id, name, funnel_stages(id, name, color, funnel_id, order)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("contacts")
      .select("source")
      .eq("type", "prospect")
      .is("deleted_at", null)
      .not("source", "is", null),
    activeCountQuery,
    archivedCountQuery,
    supabase
      .from("contact_form_responses")
      .select("contact_id"),
  ]);

  const prospects = (contactsResult.data ?? []) as ContactWithStage[];
  const total = contactsResult.count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  const tabCounts = {
    active: activeCountResult.count ?? 0,
    archived: archivedCountResult.count ?? 0,
  };

  // Count booked contacts for the current tab
  const allBookedIds = bookedResult.data
    ? [...new Set(bookedResult.data.map((r) => r.contact_id))]
    : [];
  let bookedInTab = 0;
  if (allBookedIds.length > 0) {
    const bq = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("type", "prospect")
      .is("deleted_at", null)
      .in("id", allBookedIds);
    if (tab === "archived") {
      bq.not("archived_at", "is", null);
    } else {
      bq.is("archived_at", null);
    }
    const { count } = await bq;
    bookedInTab = count ?? 0;
  }

  const stats = {
    total,
    booked: bookedInTab,
  };

  // Default sort: push future-dated records to the end, keep today/past descending
  if (sort === "created_at" && order === "desc" && !isKanban) {
    const now = new Date();
    const todayEndUTC = Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      23, 59, 59, 999
    );
    prospects.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      const aFuture = aTime > todayEndUTC;
      const bFuture = bTime > todayEndUTC;
      if (aFuture !== bFuture) return aFuture ? 1 : -1;
      return bTime - aTime;
    });
  }

  // Build lastActivityMap — most recent activity per contact
  const contactIds = prospects.map((p) => p.id);
  let lastActivityMap: Record<string, string> = {};
  let calendlyBookedIds: string[] = [];

  if (contactIds.length > 0) {
    try {
      const { data: activities } = await supabase
        .from("activities")
        .select("contact_id, created_at")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });

      if (activities) {
        const seen = new Set<string>();
        for (const a of activities) {
          if (!seen.has(a.contact_id)) {
            seen.add(a.contact_id);
            lastActivityMap[a.contact_id] = a.created_at;
          }
        }
      }
    } catch {
      // Ignore — corrupt timestamps in activities table can cause query failures
    }
  }

  // Fetch which of the current page's contacts have Calendly bookings
  if (contactIds.length > 0) {
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("contact_id")
      .in("contact_id", contactIds);
    if (bookingRows) {
      calendlyBookedIds = [...new Set(bookingRows.map((b) => b.contact_id))];
    }
  }

  // Extract filter options
  const funnelList = (funnelsResult.data ?? []).map((f) => ({ id: f.id, name: f.name }));

  const stageList = (funnelsResult.data ?? []).flatMap((f) =>
    ((f.funnel_stages ?? []) as { id: string; name: string; color: string; funnel_id: string; order: number }[]).map(
      (s) => ({ id: s.id, name: s.name, funnel_id: s.funnel_id, color: s.color, order: s.order })
    )
  );

  const stageListForFilter = stageList.map((s) => ({
    id: s.id,
    name: s.name,
    funnel_id: s.funnel_id,
  }));

  const teamMemberList = (membersResult.data ?? []).map((m) => ({ id: m.id, name: m.name }));

  const uniqueSources = [
    ...new Set(
      (sourcesResult.data ?? [])
        .map((r) => r.source)
        .filter((s): s is string => !!s)
    ),
  ].sort();

  // For kanban: determine default funnel
  const kanbanFunnelId = funnelId || funnelList[0]?.id || "";

  // Build view toggle links
  function viewToggleUrl(targetView: string) {
    const p = new URLSearchParams();
    p.set("view", targetView);
    if (tab !== "active") p.set("tab", tab);
    if (funnelId) p.set("funnel_id", funnelId);
    return `/prospects?${p.toString()}`;
  }

  return (
    <div className="page-enter space-y-4">
      {/* Row 1: Title + stats | Tabs + View toggle + Add */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Prospects</h1>
          <div className="hidden items-center gap-3 text-sm text-muted-foreground sm:flex">
            <span className="tabular-nums font-medium text-foreground">{stats.total}</span>
            <span>total</span>
            <span className="text-border">|</span>
            <span className="tabular-nums font-medium text-foreground">{stats.booked}</span>
            <span>booked</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Active / Archived tabs */}
          <div className="flex items-center rounded-lg border p-0.5">
            <Link
              href="/prospects"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "active"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Active
            </Link>
            <Link
              href="/prospects?tab=archived"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "archived"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Archive className="size-3.5" />
              Archived
            </Link>
          </div>

          {/* List / Kanban toggle */}
          <div className="hidden items-center rounded-lg border p-0.5 sm:flex">
            <Link
              href={viewToggleUrl("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                view === "list"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="size-4" />
            </Link>
            <Link
              href={viewToggleUrl("kanban")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                view === "kanban"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Columns3 className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      <Suspense>
        {view === "kanban" ? (
          <ProspectKanban
            contacts={prospects}
            funnels={funnelList}
            stages={stageList}
            currentFunnelId={kanbanFunnelId}
            lastActivityMap={lastActivityMap}
          />
        ) : (
          <ProspectList
            prospects={prospects}
            total={total}
            page={page}
            perPage={perPage}
            totalPages={totalPages}
            filterOptions={{
              sources: uniqueSources,
              funnels: funnelList,
              stages: stageListForFilter,
              teamMembers: teamMemberList,
            }}
            lastActivityMap={lastActivityMap}
            bookedContactIds={calendlyBookedIds}
            openForm={params.action === "new"}
            tab={tab}
            stats={stats}
          />
        )}
      </Suspense>
    </div>
  );
}

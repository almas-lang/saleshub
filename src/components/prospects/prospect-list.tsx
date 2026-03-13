"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  ArrowRightLeft,
  Tag,
  X,
  Upload,
  ExternalLink,
  Columns3,
  Archive,
  ArchiveRestore,
  CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch, throwOnError } from "@/lib/fetch";
import { cn, formatDate, formatPhone, timeAgo } from "@/lib/utils";
import type { ContactWithStage } from "@/types/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ProspectFilters } from "./prospect-filters";
import { MobileFilterSheet } from "./mobile-filter-sheet";
import { ProspectForm } from "./prospect-form";

interface FilterOptions {
  sources: string[];
  funnels: { id: string; name: string }[];
  stages: { id: string; name: string; funnel_id: string }[];
  teamMembers: { id: string; name: string }[];
}

interface ProspectStats {
  total: number;
  booked: number;
}

interface ProspectListProps {
  prospects: ContactWithStage[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  filterOptions: FilterOptions;
  lastActivityMap: Record<string, string>;
  openForm?: boolean;
  tab?: "active" | "archived";
  stats?: ProspectStats;
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > 3) {
    pages.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  pages.push(total);

  return pages;
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

function getActivityTimeColor(date: string | undefined) {
  if (!date) return "text-muted-foreground";
  const elapsed = Date.now() - new Date(date).getTime();
  if (elapsed > FIVE_DAYS_MS) return "text-destructive";
  if (elapsed > TWO_DAYS_MS) return "text-amber-500";
  return "text-emerald-500";
}

const ALL_COLUMNS = [
  { key: "first_name", label: "Name", sortable: true, defaultVisible: true },
  { key: "email", label: "Email", sortable: true, defaultVisible: true },
  { key: "phone", label: "Phone", sortable: false, defaultVisible: true },
  { key: "source", label: "Source", sortable: true, defaultVisible: false },
  { key: "current_stage_id", label: "Stage", sortable: false, defaultVisible: true },
  { key: "assigned_to", label: "Assigned To", sortable: false, defaultVisible: true },
  { key: "created_at", label: "Created", sortable: true, defaultVisible: true },
  { key: "call_booked", label: "Call Booked", sortable: false, defaultVisible: true },
  { key: "watch_link", label: "Watch Link", sortable: false, defaultVisible: true },
  { key: "last_activity", label: "Last Activity", sortable: false, defaultVisible: true },
] as const;

const STORAGE_KEY = "prospect-visible-columns";

export function ProspectList({
  prospects,
  total,
  page,
  perPage,
  totalPages,
  filterOptions,
  lastActivityMap,
  openForm = false,
  tab = "active",
  stats,
}: ProspectListProps) {
  const isArchived = tab === "archived";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(openForm);
  const [editingProspect, setEditingProspect] = useState<ContactWithStage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState(searchParams.get("search") ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
  );

  // Sync visible columns with localStorage after mount (avoids hydration mismatch)
  const [columnsHydrated, setColumnsHydrated] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setVisibleColumns(new Set(JSON.parse(saved)));
      } catch {
        // ignore corrupt data
      }
    }
    setColumnsHydrated(true);
  }, []);

  useEffect(() => {
    if (columnsHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...visibleColumns]));
    }
  }, [visibleColumns, columnsHydrated]);

  const currentSort = searchParams.get("sort") ?? "created_at";
  const currentOrder = searchParams.get("order") ?? "desc";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      if (!("page" in updates)) {
        params.delete("page");
      }
      params.delete("action");
      router.push(`/prospects?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      const timeout = setTimeout(() => {
        updateParams({ search: value });
      }, 300);
      return () => clearTimeout(timeout);
    },
    [updateParams]
  );

  function handleSort(column: string) {
    if (currentSort === column) {
      updateParams({ sort: column, order: currentOrder === "asc" ? "desc" : "asc" });
    } else {
      updateParams({ sort: column, order: "asc" });
    }
  }

  function handleFilterChange(key: string, value: string) {
    updateParams({ [key]: value });
  }

  function handleClearFilters() {
    router.push(isArchived ? "/prospects?tab=archived" : "/prospects");
    setSearchValue("");
  }

  // Row selection
  const allSelected = prospects.length > 0 && prospects.every((p) => selectedIds.has(p.id));
  const someSelected = prospects.some((p) => selectedIds.has(p.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prospects.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkAction(
    action: string,
    extra?: Record<string, string>
  ) {
    const ids = Array.from(selectedIds);
    const count = ids.length;

    if (action === "delete") {
      // Pattern C — undo toast for deletes
      (async () => {
        setBulkLoading(true);
        const result = await safeFetch("/api/contacts/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", contact_ids: ids }),
        });
        setBulkLoading(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setSelectedIds(new Set());
        router.refresh();
        toast(`${count} prospect${count !== 1 ? "s" : ""} deleted`, {
          action: {
            label: "Undo",
            onClick: async () => {
              const restore = await safeFetch("/api/contacts/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "restore", contact_ids: ids }),
              });
              if (restore.ok) {
                toast.success("Restored");
                router.refresh();
              } else {
                toast.error(restore.error);
              }
            },
          },
          duration: 6000,
        });
      })();
      return;
    }

    // Pattern B — toast.promise for bulk assign/move/tag
    setBulkLoading(true);
    toast.promise(
      throwOnError(
        safeFetch("/api/contacts/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, contact_ids: ids, ...extra }),
        })
      ).then(() => {
        setSelectedIds(new Set());
        router.refresh();
      }).finally(() => setBulkLoading(false)),
      {
        loading: `Processing ${count} prospect${count !== 1 ? "s" : ""}...`,
        success: `Bulk ${action.replace("_", " ")} completed for ${count} prospect${count !== 1 ? "s" : ""}`,
        error: (err) => err.message,
      }
    );
  }

  function handleArchive(ids?: string[]) {
    const targetIds = ids ?? Array.from(selectedIds);
    const count = targetIds.length;
    const action = isArchived ? "unarchive" : "archive";

    setBulkLoading(true);
    toast.promise(
      throwOnError(
        safeFetch("/api/contacts/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, contact_ids: targetIds }),
        })
      ).then(() => {
        setSelectedIds(new Set());
        router.refresh();
      }).finally(() => setBulkLoading(false)),
      {
        loading: `${isArchived ? "Unarchiving" : "Archiving"} ${count} prospect${count !== 1 ? "s" : ""}...`,
        success: `${count} prospect${count !== 1 ? "s" : ""} ${isArchived ? "unarchived" : "archived"}`,
        error: (err) => err.message,
      }
    );
  }

  async function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    const result = await safeFetch(`/api/contacts/${id}`, { method: "DELETE" });
    setDeleteId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
    toast("Prospect deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          const restore = await safeFetch("/api/contacts/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "restore", contact_ids: [id] }),
          });
          if (restore.ok) {
            toast.success("Restored");
            router.refresh();
          } else {
            toast.error(restore.error);
          }
        },
      },
      duration: 6000,
    });
  }

  const filters = {
    source: searchParams.get("source") ?? "",
    funnel_id: searchParams.get("funnel_id") ?? "",
    stage_id: searchParams.get("stage_id") ?? "",
    assigned_to: searchParams.get("assigned_to") ?? "",
    booked: searchParams.get("booked") ?? "",
  };

  return (
    <>
      {/* Search + Filters + Actions — single toolbar row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9 h-9"
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="hidden lg:block">
            <ProspectFilters
              sources={filterOptions.sources}
              funnels={filterOptions.funnels}
              stages={filterOptions.stages}
              teamMembers={filterOptions.teamMembers}
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="size-9 shrink-0">
                <Columns3 className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ALL_COLUMNS.filter((c) => c.key !== "first_name").map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleColumns.has(col.key)}
                  onCheckedChange={(checked) => {
                    setVisibleColumns((prev) => {
                      const next = new Set(prev);
                      if (checked) {
                        next.add(col.key);
                      } else {
                        next.delete(col.key);
                      }
                      return next;
                    });
                  }}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" asChild>
            <Link href="/prospects/import">
              <Upload className="mr-1.5 size-3.5" />
              Import
            </Link>
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />
            Add
          </Button>
        </div>
      </div>
      <div className="lg:hidden">
        <MobileFilterSheet
          sources={filterOptions.sources}
          funnels={filterOptions.funnels}
          stages={filterOptions.stages}
          teamMembers={filterOptions.teamMembers}
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      </div>

      {prospects.length === 0 ? (
        <EmptyState
          icon={isArchived ? Archive : Users}
          title={isArchived ? "No archived prospects" : "No prospects found"}
          description={
            isArchived
              ? searchParams.has("search")
                ? "Try adjusting your search."
                : "Prospects you archive will appear here."
              : searchParams.toString()
                ? "Try adjusting your search or filters."
                : "Add your first prospect to get started."
          }
          action={
            !isArchived && !searchParams.toString()
              ? { label: "Add prospect", onClick: () => setFormOpen(true) }
              : undefined
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border lg:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  {ALL_COLUMNS.filter(
                    (col) => col.key === "first_name" || visibleColumns.has(col.key)
                  ).map((col) =>
                    col.sortable ? (
                      <TableHead key={col.key}>
                        <button
                          className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                          onClick={() => handleSort(col.key)}
                        >
                          {col.label}
                          <ArrowUpDown
                            className={cn(
                              "size-3",
                              currentSort === col.key
                                ? "text-foreground"
                                : "text-muted-foreground/40"
                            )}
                          />
                        </button>
                      </TableHead>
                    ) : (
                      <TableHead key={col.key}>
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {col.label}
                        </span>
                      </TableHead>
                    )
                  )}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map((prospect) => (
                  <TableRow
                    key={prospect.id}
                    className={cn(
                      "h-12 cursor-pointer",
                      selectedIds.has(prospect.id) && "bg-primary/5"
                    )}
                    onClick={() => router.push(`/prospects/${prospect.id}`)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(prospect.id)}
                        onCheckedChange={() => toggleOne(prospect.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${prospect.first_name}`}
                      />
                    </TableCell>
                    {ALL_COLUMNS.filter(
                      (col) => col.key === "first_name" || visibleColumns.has(col.key)
                    ).map((col) => {
                      switch (col.key) {
                        case "first_name":
                          return (
                            <TableCell key={col.key} className="font-medium">
                              {prospect.first_name} {prospect.last_name ?? ""}
                            </TableCell>
                          );
                        case "email":
                          return (
                            <TableCell key={col.key} className="text-muted-foreground">
                              {prospect.email ?? "—"}
                            </TableCell>
                          );
                        case "phone":
                          return (
                            <TableCell key={col.key} className="font-mono text-muted-foreground">
                              {prospect.phone ?? "—"}
                            </TableCell>
                          );
                        case "source":
                          return (
                            <TableCell key={col.key} className="text-muted-foreground">
                              {prospect.source ?? "—"}
                            </TableCell>
                          );
                        case "current_stage_id":
                          return (
                            <TableCell key={col.key}>
                              {prospect.funnel_stages ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                  <span
                                    className="inline-block size-1.5 rounded-full"
                                    style={{ backgroundColor: prospect.funnel_stages.color }}
                                  />
                                  {prospect.funnel_stages.name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        case "assigned_to":
                          return (
                            <TableCell key={col.key} className="text-muted-foreground">
                              {prospect.team_members?.name ?? "—"}
                            </TableCell>
                          );
                        case "created_at":
                          return (
                            <TableCell key={col.key} className="text-xs text-muted-foreground">
                              {formatDate(prospect.created_at)}
                            </TableCell>
                          );
                        case "call_booked": {
                          const cbMeta = prospect.metadata as Record<string, string> | null;
                          const callBooked = cbMeta
                            ? cbMeta["CallBooked"] || cbMeta["Call Booked"] || cbMeta["Call_Booked"] || cbMeta["call_booked"] || cbMeta["call booked"] || cbMeta["callBooked"] || cbMeta["Booked"] || cbMeta["booked"]
                            : undefined;
                          const isBooked = callBooked && callBooked.toLowerCase() !== "no" && callBooked.toLowerCase() !== "false" && callBooked.trim() !== "";
                          return (
                            <TableCell key={col.key}>
                              {isBooked ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                  <CheckCircle2 className="size-3.5" />
                                  {callBooked}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        }
                        case "watch_link": {
                          const meta = prospect.metadata as Record<string, string> | null;
                          const watchLink = meta
                            ? meta["Watch Link"] || meta["Watch_Link"] || meta["watch_link"] || meta["watch link"] || meta["watchLink"]
                            : undefined;
                          return (
                            <TableCell key={col.key}>
                              {watchLink ? (
                                <a
                                  href={watchLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Watch
                                  <ExternalLink className="size-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        }
                        case "last_activity":
                          return (
                            <TableCell key={col.key} suppressHydrationWarning>
                              {lastActivityMap[prospect.id] ? (
                                <span
                                  suppressHydrationWarning
                                  className={cn(
                                    "text-xs",
                                    getActivityTimeColor(lastActivityMap[prospect.id])
                                  )}
                                >
                                  {timeAgo(lastActivityMap[prospect.id])}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        default:
                          return null;
                      }
                    })}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProspect(prospect);
                            }}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchive([prospect.id]);
                            }}
                          >
                            {isArchived ? (
                              <><ArchiveRestore className="mr-2 size-4" /> Unarchive</>
                            ) : (
                              <><Archive className="mr-2 size-4" /> Archive</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(prospect.id);
                            }}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list */}
          <div className="flex flex-col gap-2 lg:hidden">
            {prospects.map((prospect) => {
              const initials =
                (prospect.first_name?.[0] ?? "") +
                (prospect.last_name?.[0] ?? "");
              const activity = lastActivityMap[prospect.id];
              const cbMobileMeta = prospect.metadata as Record<string, string> | null;
              const mobileCallBooked = cbMobileMeta
                ? cbMobileMeta["CallBooked"] || cbMobileMeta["Call Booked"] || cbMobileMeta["Call_Booked"] || cbMobileMeta["call_booked"] || cbMobileMeta["call booked"] || cbMobileMeta["callBooked"] || cbMobileMeta["Booked"] || cbMobileMeta["booked"]
                : undefined;
              const mobileIsBooked = mobileCallBooked && mobileCallBooked.toLowerCase() !== "no" && mobileCallBooked.toLowerCase() !== "false" && mobileCallBooked.trim() !== "";

              return (
                <div
                  key={prospect.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 active:bg-muted/50",
                    selectedIds.has(prospect.id) && "bg-primary/5"
                  )}
                  onClick={() => router.push(`/prospects/${prospect.id}`)}
                >
                  <Checkbox
                    checked={selectedIds.has(prospect.id)}
                    onCheckedChange={() => toggleOne(prospect.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1"
                    aria-label={`Select ${prospect.first_name}`}
                  />

                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials.toUpperCase()}
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {prospect.first_name} {prospect.last_name ?? ""}
                      </span>
                      {prospect.funnel_stages && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium">
                          <span
                            className="inline-block size-1.5 rounded-full"
                            style={{ backgroundColor: prospect.funnel_stages.color }}
                          />
                          {prospect.funnel_stages.name}
                        </span>
                      )}
                    </div>

                    <span className="truncate text-sm text-muted-foreground">
                      {prospect.phone
                        ? formatPhone(prospect.phone)
                        : prospect.email ?? "—"}
                    </span>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          suppressHydrationWarning
                          className={cn(
                            "text-xs",
                            getActivityTimeColor(activity)
                          )}
                        >
                          {activity ? timeAgo(activity) : "No activity"}
                        </span>
                        {mobileIsBooked && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600">
                            <CheckCircle2 className="size-3" />
                            {mobileCallBooked}
                          </span>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProspect(prospect);
                            }}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchive([prospect.id]);
                            }}
                          >
                            {isArchived ? (
                              <><ArchiveRestore className="mr-2 size-4" /> Unarchive</>
                            ) : (
                              <><Archive className="mr-2 size-4" /> Archive</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(prospect.id);
                            }}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination — Desktop */}
          <div className="hidden items-center justify-between lg:flex">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of{" "}
              {total} prospect{total !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(perPage)}
                onValueChange={(v) => updateParams({ per_page: v, page: "1" })}
              >
                <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">/ page</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                <ChevronLeft className="size-4" />
              </Button>
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="size-8 p-0 text-xs"
                    onClick={() => updateParams({ page: String(p) })}
                  >
                    {p}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Pagination — Mobile */}
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <div className="flex items-center gap-2">
              <Select
                value={String(perPage)}
                onValueChange={(v) => updateParams({ per_page: v, page: "1" })}
              >
                <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">/ page</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Bulk Action Bar — sticky bottom */}
      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t bg-card px-6 py-3 shadow-lg animate-in slide-in-from-bottom-4 lg:bottom-0">
          <div className="mx-auto flex max-w-screen-xl items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>

            <div className="ml-2 flex flex-wrap items-center gap-2">
              <Select
                onValueChange={(v) => handleBulkAction("assign", { assigned_to: v })}
                disabled={bulkLoading}
              >
                <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
                  <UserPlus className="size-3.5" />
                  <SelectValue placeholder="Assign" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                onValueChange={(v) => {
                  const stage = filterOptions.stages.find((s) => s.id === v);
                  handleBulkAction("move_stage", {
                    stage_id: v,
                    funnel_id: stage?.funnel_id ?? "",
                  });
                }}
                disabled={bulkLoading}
              >
                <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
                  <ArrowRightLeft className="size-3.5" />
                  <SelectValue placeholder="Move stage" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs" disabled={bulkLoading}>
                    <Tag className="mr-1.5 size-3.5" />
                    Tag
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {["hot", "warm", "cold", "VIP", "follow-up"].map((tag) => (
                    <DropdownMenuItem
                      key={tag}
                      onClick={() => handleBulkAction("add_tag", { tag })}
                    >
                      {tag}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={bulkLoading}
                onClick={() => handleArchive()}
              >
                {isArchived ? (
                  <><ArchiveRestore className="mr-1.5 size-3.5" /> Unarchive</>
                ) : (
                  <><Archive className="mr-1.5 size-3.5" /> Archive</>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-destructive"
                disabled={bulkLoading}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-8 text-xs"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="mr-1 size-3.5" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Single delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete prospect?"
        description="This prospect will be removed from your list. This action can be undone by an admin."
        onConfirm={handleDelete}
        destructive
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selectedIds.size} prospects?`}
        description="These prospects will be removed from your list. This action can be undone by an admin."
        onConfirm={() => {
          setBulkDeleteOpen(false);
          handleBulkAction("delete");
        }}
        destructive
      />

      <ProspectForm
        open={formOpen || !!editingProspect}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingProspect(null);
          }
        }}
        prospect={editingProspect}
        funnels={filterOptions.funnels}
        stages={filterOptions.stages}
        teamMembers={filterOptions.teamMembers}
      />
    </>
  );
}

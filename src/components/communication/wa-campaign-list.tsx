"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Eye,
  Pencil,
  Pause,
  Play,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { WACampaignWithStats, CampaignStatus, CampaignType } from "@/types/campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface WACampaignListProps {
  campaigns: WACampaignWithStats[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const STATUS_TABS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" },
];

const STATUS_STYLES: Record<CampaignStatus, { className: string }> = {
  draft: { className: "bg-muted text-muted-foreground" },
  active: { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  paused: { className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  completed: { className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
};

const TYPE_LABELS: Record<CampaignType, string> = {
  one_time: "One-time",
  drip: "Drip",
  newsletter: "Newsletter",
};

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

export function WACampaignList({
  campaigns,
  total,
  page,
  perPage,
  totalPages,
}: WACampaignListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") ?? "");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const currentSort = searchParams.get("sort") ?? "created_at";
  const currentOrder = searchParams.get("order") ?? "desc";
  const currentStatus = searchParams.get("status") ?? "";
  const currentType = searchParams.get("type") ?? "";

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
      // Reset to page 1 on filter/search change (unless explicitly setting page)
      if (!("page" in updates)) {
        params.delete("page");
      }
      router.push(`/whatsapp?${params.toString()}`);
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

  async function handleDelete() {
    if (!deleteId) return;
    const result = await safeFetch(`/api/campaigns/whatsapp?id=${deleteId}`, {
      method: "DELETE",
    });
    setDeleteId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
    toast.success("Campaign deleted");
  }

  async function handleTogglePause(campaign: WACampaignWithStats) {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    const result = await safeFetch(`/api/campaigns/whatsapp?id=${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
    toast.success(`Campaign ${newStatus === "active" ? "resumed" : "paused"}`);
  }

  const hasFilters = currentStatus || currentType || searchParams.get("search");

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            className="pl-9"
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={currentType || "all"}
            onValueChange={(v) => updateParams({ type: v === "all" ? "" : v })}
          >
            <SelectTrigger className="h-9 w-auto gap-1.5 text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="one_time">One-time</SelectItem>
              <SelectItem value="drip">Drip</SelectItem>
              <SelectItem value="newsletter">Newsletter</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/whatsapp/campaigns/new">
              <Plus className="mr-2 size-4" />
              New Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => updateParams({ status: tab.value })}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              currentStatus === tab.value
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No campaigns yet"
          description={
            hasFilters
              ? "Try adjusting your search or filters."
              : "Create your first WhatsApp campaign to reach your prospects."
          }
          action={
            !hasFilters
              ? {
                  label: "New Campaign",
                  onClick: () => router.push("/whatsapp/campaigns/new"),
                }
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
                  <TableHead>
                    <button
                      className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort("name")}
                    >
                      Name
                      <ArrowUpDown
                        className={cn(
                          "size-3",
                          currentSort === "name"
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                        )}
                      />
                    </button>
                  </TableHead>
                  <TableHead>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Type
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </span>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort("recipient_count")}
                    >
                      Recipients
                      <ArrowUpDown
                        className={cn(
                          "size-3",
                          currentSort === "recipient_count"
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                        )}
                      />
                    </button>
                  </TableHead>
                  <TableHead>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Delivered
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Read
                    </span>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort("created_at")}
                    >
                      Created
                      <ArrowUpDown
                        className={cn(
                          "size-3",
                          currentSort === "created_at"
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                        )}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    className="h-12 cursor-pointer"
                    onClick={() => router.push(`/whatsapp/campaigns/${campaign.id}`)}
                  >
                    <TableCell className="font-medium">
                      {campaign.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {TYPE_LABELS[campaign.type] ?? campaign.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-xs font-medium capitalize border-0",
                          STATUS_STYLES[campaign.status]?.className
                        )}
                      >
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {campaign.recipient_count}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {campaign.delivered_count}
                      {campaign.recipient_count > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground/60">
                          ({pct(campaign.delivered_count, campaign.recipient_count)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {campaign.read_count}
                      {campaign.recipient_count > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground/60">
                          ({pct(campaign.read_count, campaign.recipient_count)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span title={formatDateTime(campaign.created_at)}>{timeAgo(campaign.created_at)}</span>
                    </TableCell>
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
                              router.push(`/whatsapp/campaigns/${campaign.id}`);
                            }}
                          >
                            <Eye className="mr-2 size-4" />
                            View
                          </DropdownMenuItem>
                          {(campaign.status === "draft" || campaign.status === "paused") && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/whatsapp/campaigns/${campaign.id}?edit=true`);
                              }}
                            >
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {(campaign.status === "active" || campaign.status === "paused") && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePause(campaign);
                              }}
                            >
                              {campaign.status === "active" ? (
                                <>
                                  <Pause className="mr-2 size-4" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="mr-2 size-4" />
                                  Resume
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(campaign.id);
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

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 lg:hidden">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 active:bg-muted/50"
                onClick={() => router.push(`/whatsapp/campaigns/${campaign.id}`)}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <MessageCircle className="size-4 text-primary" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{campaign.name}</span>
                    <Badge
                      className={cn(
                        "shrink-0 text-[11px] font-medium capitalize border-0",
                        STATUS_STYLES[campaign.status]?.className
                      )}
                    >
                      {campaign.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px] font-normal">
                      {TYPE_LABELS[campaign.type] ?? campaign.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      <span title={formatDateTime(campaign.created_at)}>{timeAgo(campaign.created_at)}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{campaign.sent_count} sent</span>
                      <span>{campaign.delivered_count} delivered</span>
                      <span>{campaign.read_count} read</span>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/whatsapp/campaigns/${campaign.id}`);
                          }}
                        >
                          <Eye className="mr-2 size-4" />
                          View
                        </DropdownMenuItem>
                        {(campaign.status === "draft" || campaign.status === "paused") && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/whatsapp/campaigns/${campaign.id}?edit=true`);
                            }}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {(campaign.status === "active" || campaign.status === "paused") && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePause(campaign);
                            }}
                          >
                            {campaign.status === "active" ? (
                              <>
                                <Pause className="mr-2 size-4" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 size-4" />
                                Resume
                              </>
                            )}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(campaign.id);
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
            ))}
          </div>

          {/* Pagination — Desktop */}
          <div className="hidden items-center justify-between lg:flex">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of{" "}
              {total} campaign{total !== 1 ? "s" : ""}
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

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete campaign?"
        description="This will permanently delete the campaign and all associated sends. This action cannot be undone."
        onConfirm={handleDelete}
        destructive
      />
    </>
  );
}

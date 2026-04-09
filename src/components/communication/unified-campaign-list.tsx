"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Pencil,
  Pause,
  Play,
  Megaphone,
  Mail,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch, throwOnError } from "@/lib/fetch";
import { formatDateTime } from "@/lib/utils";
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

interface UnifiedCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  audience_filter: Record<string, unknown> | null;
  flow_data: unknown;
  stop_condition: unknown;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  paused: { label: "Paused", variant: "outline" },
  completed: { label: "Completed", variant: "secondary" },
};

const TYPE_LABELS: Record<string, string> = {
  drip: "Drip",
  one_time: "One-time",
  newsletter: "Newsletter",
};

export function UnifiedCampaignListClient({
  campaigns,
}: {
  campaigns: UnifiedCampaign[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = campaigns;
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [campaigns, search, statusFilter]);

  async function handleToggleStatus(campaign: UnifiedCampaign) {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    try {
      await throwOnError(
        safeFetch(`/api/campaigns/unified?id=${campaign.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        })
      );
      toast.success(`Campaign ${newStatus === "active" ? "activated" : "paused"}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await throwOnError(
        safeFetch(`/api/campaigns/unified?id=${id}`, { method: "DELETE" })
      );
      toast.success("Campaign deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => router.push("/campaigns/new")} size="sm">
          <Plus className="mr-2 size-4" />
          New campaign
        </Button>
      </div>

      {/* Table */}
      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create unified campaigns that mix WhatsApp and Email in a single drip flow."
          action={{
            label: "Create campaign",
            onClick: () => router.push("/campaigns/new"),
          }}
        />
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[180px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No campaigns matching your filters
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((campaign) => {
                const statusStyle = STATUS_STYLES[campaign.status] ?? {
                  label: campaign.status,
                  variant: "outline" as const,
                };

                return (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/campaigns/${campaign.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Megaphone className="size-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{campaign.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {TYPE_LABELS[campaign.type] ?? campaign.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusStyle.variant}>{statusStyle.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(campaign.created_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(campaign.status === "active" || campaign.status === "paused") && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(campaign);
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
                          {campaign.status === "draft" && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/campaigns/${campaign.id}`);
                              }}
                            >
                              <Pencil className="mr-2 size-4" />
                              Edit
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete campaign?"
        description="This will permanently delete this campaign and all its steps. Enrolled contacts will be removed. This cannot be undone."
        onConfirm={handleDelete}
        destructive
      />
    </>
  );
}

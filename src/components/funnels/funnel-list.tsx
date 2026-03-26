"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreVertical, Pencil, Trash2, Layers, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { safeFetch, throwOnError } from "@/lib/fetch";
import type { Funnel } from "@/types/funnels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatCard } from "@/components/shared/stat-card";
import { FunnelForm } from "./funnel-form";

type FunnelWithCount = Funnel & { stage_count: number; contact_count: number };

const SALES_TYPE_LABELS: Record<string, string> = {
  vsl: "VSL",
  webinar: "Webinar",
  workshop: "Workshop",
  short_course: "Short Course",
  direct_outreach: "Direct Outreach",
  custom: "Custom",
};

interface FunnelListProps {
  funnels: FunnelWithCount[];
  stats: { totalFunnels: number; totalContacts: number };
}

export function FunnelList({ funnels, stats }: FunnelListProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    let result = funnels;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") {
      result = result.filter((f) => f.sales_type === typeFilter);
    }
    return result;
  }, [funnels, search, typeFilter]);

  function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);

    toast.promise(
      throwOnError(safeFetch(`/api/funnels/${id}`, { method: "DELETE" }))
        .then(() => router.refresh()),
      {
        loading: "Deleting funnel...",
        success: "Funnel deleted",
        error: (err) => err.message,
      }
    );
  }

  const avgPerFunnel =
    stats.totalFunnels > 0
      ? Math.round(stats.totalContacts / stats.totalFunnels)
      : 0;

  return (
    <>
      {/* Stats */}
      {funnels.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Funnels" value={stats.totalFunnels} format="number" color="blue" index={0} />
          <StatCard label="Total Contacts" value={stats.totalContacts} format="number" color="emerald" index={1} />
          <StatCard label="Avg. per Funnel" value={avgPerFunnel} format="number" index={2} />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search funnels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-48 pl-9 text-sm"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(SALES_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setFormOpen(true)} size="sm">
          <Plus className="mr-2 size-4" />
          Create funnel
        </Button>
      </div>

      {funnels.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 shadow-sm">
          <Layers className="mb-4 size-12 text-muted-foreground" />
          <CardTitle className="mb-1">No funnels yet</CardTitle>
          <CardDescription>
            Create your first funnel to start managing your sales pipeline.
          </CardDescription>
          <Button className="mt-4" onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 size-4" />
            Create funnel
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[180px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No funnels matching your filters
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((funnel, index) => (
            <Card
              key={funnel.id}
              className="cursor-pointer shadow-sm transition-all duration-150 hover:border-foreground/20 hover:shadow-md"
              style={{
                animation: `fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both`,
              }}
              onClick={() => router.push(`/funnels/${funnel.id}`)}
            >
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <CardTitle className="text-base">{funnel.name}</CardTitle>
                  {funnel.description && (
                    <CardDescription className="line-clamp-2">
                      {funnel.description}
                    </CardDescription>
                  )}
                </div>
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
                        setEditingFunnel(funnel);
                      }}
                    >
                      <Pencil className="mr-2 size-4" />
                      Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(funnel.id);
                      }}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {SALES_TYPE_LABELS[funnel.sales_type] ?? funnel.sales_type}
                  </Badge>
                  {funnel.is_default && (
                    <Badge variant="outline">Default</Badge>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="size-3" />
                    {funnel.stage_count} stage{funnel.stage_count !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3" />
                    {funnel.contact_count} contact{funnel.contact_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete funnel?"
        description="This will permanently delete this funnel and all its stages. This action cannot be undone."
        onConfirm={handleDelete}
        destructive
      />

      <FunnelForm
        open={formOpen || !!editingFunnel}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingFunnel(null);
          }
        }}
        funnel={editingFunnel}
      />
    </>
  );
}

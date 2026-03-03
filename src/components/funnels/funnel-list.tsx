"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreVertical, Pencil, Trash2, Layers, Users } from "lucide-react";
import { toast } from "sonner";
import { safeFetch, throwOnError } from "@/lib/fetch";
import type { Funnel } from "@/types/funnels";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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

export function FunnelList({ funnels }: { funnels: FunnelWithCount[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funnels.map((funnel) => (
            <Card
              key={funnel.id}
              className="cursor-pointer shadow-sm transition-all duration-150 hover:border-foreground/20 hover:shadow-md"
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

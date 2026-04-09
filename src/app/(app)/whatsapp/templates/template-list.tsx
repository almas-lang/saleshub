"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageCircle,
  RefreshCw,
  Search,
  FileText,
  Image,
  Video,
  File,
  Plus,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { safeFetch } from "@/lib/fetch";
import type { WATemplate } from "@/lib/whatsapp/client";

const STATUS_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  APPROVED: { label: "Approved", variant: "default" },
  PENDING: { label: "Pending", variant: "secondary" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  PAUSED: { label: "Paused", variant: "outline" },
};

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utility",
  AUTHENTICATION: "Authentication",
};

function getHeaderIcon(components: WATemplate["components"]) {
  const header = components.find((c) => c.type === "HEADER");
  if (!header) return null;
  switch (header.format) {
    case "IMAGE": return <Image className="size-3.5 text-muted-foreground" />;
    case "VIDEO": return <Video className="size-3.5 text-muted-foreground" />;
    case "DOCUMENT": return <File className="size-3.5 text-muted-foreground" />;
    default: return null;
  }
}

function getBodyPreview(components: WATemplate["components"]): string {
  const body = components.find((c) => c.type === "BODY");
  return body?.text ?? "";
}

export function TemplateList({
  templates,
  fetchError,
}: {
  templates: WATemplate[];
  fetchError: string | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [viewing, setViewing] = useState<WATemplate | null>(null);

  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      getBodyPreview(t.components).toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(templates.map((t) => t.category))];

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await safeFetch(`/api/whatsapp/templates?name=${encodeURIComponent(deleteTarget)}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    if (!result.ok) {
      const errMsg = typeof result.error === "string" ? result.error : "Failed to delete template";
      if (errMsg.includes("permission")) {
        toast.error("Permission denied: Your system user needs Admin access on the WhatsApp Business Account in Meta Business Manager to delete templates.");
      } else {
        toast.error(errMsg);
      }
      return;
    }
    toast.success("Template deleted");
    router.refresh();
  }

  if (fetchError) {
    return (
      <Card className="flex flex-col items-center justify-center py-12 shadow-sm">
        <MessageCircle className="mb-4 size-12 text-muted-foreground" />
        <CardTitle className="mb-1 text-base">Could not load templates</CardTitle>
        <p className="text-sm text-muted-foreground">{fetchError}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.refresh()}>
          <RefreshCw className="mr-2 size-4" /> Retry
        </Button>
      </Card>
    );
  }

  if (templates.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-12 shadow-sm">
        <FileText className="mb-4 size-12 text-muted-foreground" />
        <CardTitle className="mb-1 text-base">No templates found</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create a template to submit it for Meta review, or refresh to sync existing ones.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => router.refresh()}>
            <RefreshCw className="mr-2 size-4" /> Refresh
          </Button>
          <Button asChild>
            <Link href="/whatsapp/templates/new">
              <Plus className="mr-2 size-4" /> Create Template
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={categoryFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(null)}
          >
            All ({templates.length})
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            >
              {CATEGORY_LABELS[cat] ?? cat} ({templates.filter((t) => t.category === cat).length})
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="size-4" />
          </Button>
          <Button size="sm" asChild>
            <Link href="/whatsapp/templates/new">
              <Plus className="mr-1.5 size-4" /> Create Template
            </Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No templates match your search.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Language</TableHead>
                <TableHead className="hidden md:table-cell">Body</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((template) => {
                const bodyPreview = getBodyPreview(template.components);
                const headerIcon = getHeaderIcon(template.components);
                const statusStyle = STATUS_STYLES[template.status] ?? {
                  label: template.status,
                  variant: "outline" as const,
                };
                const canDelete = template.status === "PENDING" || template.status === "REJECTED";

                return (
                  <TableRow
                    key={template.id ?? template.name}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setViewing(template)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {headerIcon}
                        <span className="font-medium">{template.name.replace(/_/g, " ")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusStyle.variant}>{statusStyle.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {CATEGORY_LABELS[template.category] ?? template.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{template.language}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-xs">
                      <p className="text-sm text-muted-foreground line-clamp-1">{bodyPreview}</p>
                    </TableCell>
                    <TableCell>
                      {canDelete && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(template.name)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
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
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Delete template"
        description={`Are you sure you want to delete "${deleteTarget?.replace(/_/g, " ")}"? This will remove it from Meta.`}
        onConfirm={handleDelete}
        destructive
      />

      {/* Template detail dialog */}
      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto overflow-x-hidden">
          {viewing && (() => {
            const body = viewing.components.find((c) => c.type === "BODY");
            const header = viewing.components.find((c) => c.type === "HEADER");
            const footer = viewing.components.find((c) => c.type === "FOOTER");
            const buttons = viewing.components.find((c) => c.type === "BUTTONS");
            const vs = STATUS_STYLES[viewing.status] ?? { label: viewing.status, variant: "outline" as const };
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">
                    {viewing.name.replace(/_/g, " ")}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={vs.variant}>{vs.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[viewing.category] ?? viewing.category}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{viewing.language}</span>
                  </div>
                </DialogHeader>
                <div className="mt-3 space-y-3">
                  {header?.text && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Header</p>
                      <p className="text-sm font-medium">{header.text}</p>
                    </div>
                  )}
                  {header?.format && header.format !== "TEXT" && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Header</p>
                      <p className="text-sm text-muted-foreground italic">{header.format.toLowerCase()} attachment</p>
                    </div>
                  )}
                  {body?.text && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Body</p>
                      <p className="text-sm whitespace-pre-wrap">{body.text}</p>
                    </div>
                  )}
                  {footer?.text && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Footer</p>
                      <p className="text-sm text-muted-foreground">{footer.text}</p>
                    </div>
                  )}
                  {buttons?.buttons && buttons.buttons.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Buttons</p>
                      <div className="space-y-1">
                        {buttons.buttons.map((b, i) => (
                          <div key={i} className="text-sm flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{b.type}</Badge>
                            <span>{b.text}</span>
                            {b.url && <span className="text-xs text-muted-foreground truncate">({b.url})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">API Template Name</p>
                    <code className="text-xs font-mono bg-muted/50 px-1.5 py-0.5 rounded">{viewing.name}</code>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

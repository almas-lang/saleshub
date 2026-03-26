"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Search,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch, throwOnError } from "@/lib/fetch";
import { formatDateTime } from "@/lib/utils";
import type { EmailTemplate } from "@/types/email-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EmailTemplateEditorDialog } from "./email-template-editor-dialog";

export function EmailTemplateGrid({
  templates,
}: {
  templates: EmailTemplate[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
    );
  }, [templates, search]);

  function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);

    toast.promise(
      throwOnError(
        safeFetch(`/api/email-templates/${id}`, { method: "DELETE" })
      ).then(() => router.refresh()),
      {
        loading: "Deleting template...",
        success: "Template deleted",
        error: (err) => err.message,
      }
    );
  }

  function handleDuplicate(template: EmailTemplate) {
    toast.promise(
      throwOnError(
        safeFetch("/api/email-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${template.name} (copy)`,
            subject: template.subject,
            body_html: template.body_html,
          }),
        })
      ).then(() => router.refresh()),
      {
        loading: "Duplicating template...",
        success: "Template duplicated",
        error: (err) => err.message,
      }
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <Button onClick={() => setEditorOpen(true)} size="sm">
          <Plus className="mr-2 size-4" />
          New template
        </Button>
      </div>

      {/* Grid */}
      {templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No email templates"
          description="Create reusable email templates for your campaigns and drip sequences."
          action={{
            label: "Create template",
            onClick: () => setEditorOpen(true),
          }}
        />
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[180px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No templates matching &ldquo;{search}&rdquo;
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template, index) => (
            <Card
              key={template.id}
              className="cursor-pointer shadow-sm transition-all duration-150 hover:border-foreground/20 hover:shadow-md"
              style={{
                animation: `fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both`,
              }}
              onClick={() => {
                setEditingTemplate(template);
                setEditorOpen(true);
              }}
            >
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription className="line-clamp-1">
                    {template.subject}
                  </CardDescription>
                </div>
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
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTemplate(template);
                        setEditorOpen(true);
                      }}
                    >
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicate(template);
                      }}
                    >
                      <Copy className="mr-2 size-4" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(template.id);
                      }}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-muted-foreground">
                  Updated {formatDateTime(template.updated_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <EmailTemplateEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditorOpen(false);
            setEditingTemplate(null);
          }
        }}
        template={editingTemplate}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete template?"
        description="This will permanently delete this email template. This action cannot be undone."
        onConfirm={handleDelete}
        destructive
      />
    </>
  );
}

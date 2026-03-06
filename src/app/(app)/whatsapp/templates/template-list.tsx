"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  RefreshCw,
  Search,
  FileText,
  Image,
  Video,
  File,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    case "IMAGE":
      return <Image className="size-4 text-muted-foreground" />;
    case "VIDEO":
      return <Video className="size-4 text-muted-foreground" />;
    case "DOCUMENT":
      return <File className="size-4 text-muted-foreground" />;
    default:
      return null;
  }
}

function getBodyPreview(components: WATemplate["components"]): string {
  const body = components.find((c) => c.type === "BODY");
  return body?.text ?? "";
}

function getFooterText(components: WATemplate["components"]): string | null {
  const footer = components.find((c) => c.type === "FOOTER");
  return footer?.text ?? null;
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

  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      getBodyPreview(t.components).toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(templates.map((t) => t.category))];

  if (fetchError) {
    return (
      <Card className="flex flex-col items-center justify-center py-12 shadow-sm">
        <MessageCircle className="mb-4 size-12 text-muted-foreground" />
        <CardTitle className="mb-1 text-base">
          Could not load templates
        </CardTitle>
        <p className="text-sm text-muted-foreground">{fetchError}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.refresh()}
        >
          <RefreshCw className="mr-2 size-4" />
          Retry
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
          Create templates in Meta Business Manager and they will appear here.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.refresh()}
        >
          <RefreshCw className="mr-2 size-4" />
          Refresh
        </Button>
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
              onClick={() =>
                setCategoryFilter(categoryFilter === cat ? null : cat)
              }
            >
              {CATEGORY_LABELS[cat] ?? cat} (
              {templates.filter((t) => t.category === cat).length})
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No templates match your search.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => {
            const body = getBodyPreview(template.components);
            const footer = getFooterText(template.components);
            const headerIcon = getHeaderIcon(template.components);
            const statusStyle = STATUS_STYLES[template.status] ?? {
              label: template.status,
              variant: "outline" as const,
            };

            return (
              <Card
                key={template.id ?? template.name}
                className="shadow-sm transition-all duration-150 hover:border-foreground/20 hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">
                        {template.name.replace(/_/g, " ")}
                      </CardTitle>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant={statusStyle.variant}>
                          {statusStyle.label}
                        </Badge>
                        <Badge variant="outline">
                          {CATEGORY_LABELS[template.category] ??
                            template.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {template.language}
                        </span>
                      </div>
                    </div>
                    {headerIcon}
                  </div>
                </CardHeader>
                <CardContent>
                  {body && (
                    <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
                      {body}
                    </p>
                  )}
                  {footer && (
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      {footer}
                    </p>
                  )}
                  {template.components.some((c) => c.type === "BUTTONS") && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {template.components
                        .find((c) => c.type === "BUTTONS")
                        ?.buttons?.map((btn, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="font-normal"
                          >
                            {btn.text}
                          </Badge>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

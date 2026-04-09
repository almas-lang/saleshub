"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pause,
  Play,
  Trash2,
  Clock,
  FileText,
  Users,
  Send,
  Pencil,
  X,
  Check,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type {
  EmailCampaign,
  EmailStep,
  EmailSendStatus,
  CampaignStatus,
  CampaignType,
  AudienceFilter,
} from "@/types/campaigns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailBlockEditor } from "./email-block-editor";
import { SubjectInputWithVariables } from "./subject-input-with-variables";

const STATUS_STYLES: Record<CampaignStatus, { className: string }> = {
  draft: { className: "bg-muted text-muted-foreground" },
  active: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  paused: {
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  completed: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
};

const TYPE_LABELS: Record<CampaignType, string> = {
  one_time: "One-time",
  drip: "Drip",
  newsletter: "Newsletter",
};

const SEND_STATUS_STYLES: Record<EmailSendStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  delivered:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  opened: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  clicked: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  bounced: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

interface EmailSendWithContact {
  id: string;
  contact_id: string;
  step_id: string | null;
  status: EmailSendStatus;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  contacts: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

interface EmailCampaignDetailProps {
  campaign: EmailCampaign;
  steps: EmailStep[];
  sends: EmailSendWithContact[];
  stats: {
    recipient_count: number;
    sent_count: number;
    opened_count: number;
    clicked_count: number;
    failed_count: number;
  };
  lookups: {
    funnelMap: Record<string, string>;
    stageMap: Record<string, string>;
    memberMap: Record<string, string>;
  };
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

export function EmailCampaignDetail({
  campaign,
  steps,
  sends,
  stats,
  lookups,
}: EmailCampaignDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("steps");
  const [sendFilter, setSendFilter] = useState<"all" | "sent" | "opened" | "clicked" | "failed">("all");
  const [viewingSend, setViewingSend] = useState<EmailSendWithContact | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editPreviewText, setEditPreviewText] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editDelayHours, setEditDelayHours] = useState(0);
  const [saving, setSaving] = useState(false);

  const canEdit = campaign.status === "draft" || campaign.status === "paused";

  // Auto-open first step for editing when ?edit=true
  useEffect(() => {
    if (searchParams.get("edit") === "true" && canEdit && steps.length > 0 && !editingStepId) {
      startEditing(steps[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEditing(step: EmailStep) {
    setEditingStepId(step.id);
    setEditSubject(step.subject);
    setEditPreviewText(step.preview_text ?? "");
    setEditBody(step.body_html);
    setEditDelayHours(step.delay_hours);
  }

  function cancelEditing() {
    setEditingStepId(null);
    setEditSubject("");
    setEditPreviewText("");
    setEditBody("");
    setEditDelayHours(0);
  }

  async function saveStep() {
    if (!editingStepId) return;
    setSaving(true);
    const result = await safeFetch(
      `/api/campaigns/email?id=${campaign.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: [
            {
              id: editingStepId,
              subject: editSubject,
              preview_text: editPreviewText || null,
              body_html: editBody,
              delay_hours: editDelayHours,
            },
          ],
        }),
      }
    );
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Step updated");
    setEditingStepId(null);
    router.refresh();
  }

  function renderEditOverlay() {
    if (!editingStepId) return null;
    const step = steps.find((s) => s.id === editingStepId);
    if (!step) return null;

    return createPortal(
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="size-8" onClick={cancelEditing}>
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Edit Step {step.order}</h1>
              <p className="text-xs text-muted-foreground">
                {editSubject || "Untitled email"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={cancelEditing} disabled={saving}>Cancel</Button>
            <Button onClick={saveStep} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>

        {/* Content: editor + preview */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_420px]">
          {/* Left: scrollable editor */}
          <div className="overflow-y-auto px-8 py-6">
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="space-y-2">
                <Label>Subject</Label>
                <SubjectInputWithVariables
                  value={editSubject}
                  onChange={setEditSubject}
                  placeholder="Email subject line..."
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Preview Text
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    shown in inbox before opening
                  </span>
                </Label>
                <Input
                  placeholder="Optional preview text..."
                  value={editPreviewText}
                  onChange={(e) => setEditPreviewText(e.target.value)}
                  maxLength={150}
                />
              </div>

              <div className="space-y-2">
                <Label>Delay (hours)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editDelayHours}
                  onChange={(e) => setEditDelayHours(parseInt(e.target.value) || 0)}
                  className="max-w-xs"
                />
              </div>

              <div className="space-y-2">
                <Label>Body</Label>
                <EmailBlockEditor
                  key={editingStepId}
                  content={editBody}
                  onChange={setEditBody}
                  placeholder="Write your email content..."
                />
              </div>
            </div>
          </div>

          {/* Right: sticky email preview */}
          <div className="hidden lg:flex flex-col border-l bg-muted/10 min-h-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Eye className="size-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Preview</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {/* Inbox preview */}
              <div className="mb-4 rounded-lg border p-3 space-y-0.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Inbox Preview</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {editSubject || "No subject"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {editPreviewText || (editBody
                    ? editBody.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").slice(0, 100)
                    : "No content yet..."
                  )}
                </p>
              </div>

              {/* Email body preview */}
              <div className="rounded-lg border bg-white dark:bg-card">
                <div className="border-b px-5 py-4">
                  <p className="text-base font-semibold text-foreground">
                    {editSubject || "No subject"}
                  </p>
                </div>
                <div className="px-5 py-4">
                  {editBody ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: editBody }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Start writing to see the preview...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  async function handleActivate() {
    setLoading(true);
    const result = await safeFetch(
      `/api/campaigns/email?id=${campaign.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      }
    );
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
    toast.success("Campaign activated");
  }

  async function handleTogglePause() {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    setLoading(true);
    const result = await safeFetch(
      `/api/campaigns/email?id=${campaign.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }
    );
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
    toast.success(
      `Campaign ${newStatus === "active" ? "resumed" : "paused"}`
    );
  }

  async function handleDelete() {
    setLoading(true);
    const result = await safeFetch(
      `/api/campaigns/email?id=${campaign.id}`,
      { method: "DELETE" }
    );
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Campaign deleted");
    router.push("/email");
  }

  const filter = campaign.audience_filter as AudienceFilter | null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link href="/email">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{campaign.name}</h1>
              <Badge
                className={cn(
                  "text-xs font-medium capitalize border-0",
                  STATUS_STYLES[campaign.status]?.className
                )}
              >
                {campaign.status}
              </Badge>
              <Badge variant="outline" className="text-xs font-normal">
                {TYPE_LABELS[campaign.type] ?? campaign.type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Created {formatDate(campaign.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link href={`/email/campaigns/${campaign.id}/edit`}>
                <Pencil className="mr-2 size-4" />
                Edit Campaign
              </Link>
            </Button>
          )}
          {campaign.status === "draft" && (
            <Button
              size="sm"
              onClick={() => handleActivate()}
              disabled={loading || steps.length === 0}
            >
              <Play className="mr-2 size-4" />
              Activate
            </Button>
          )}
          {(campaign.status === "active" || campaign.status === "paused") && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePause}
              disabled={loading}
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
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDelete(true)}
            disabled={loading}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats row — clickable to filter Sends tab */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {([
          { label: "Recipients", value: stats.recipient_count, filter: "all" as const, pctVal: null },
          { label: "Sent", value: stats.sent_count, filter: "sent" as const, pctVal: null },
          { label: "Opened", value: stats.opened_count, filter: "opened" as const, pctVal: stats.sent_count > 0 ? pct(stats.opened_count, stats.sent_count) : null },
          { label: "Clicked", value: stats.clicked_count, filter: "clicked" as const, pctVal: stats.sent_count > 0 ? pct(stats.clicked_count, stats.sent_count) : null },
          { label: "Failed", value: stats.failed_count, filter: "failed" as const, pctVal: null },
        ]).map((card) => (
          <button
            key={card.label}
            onClick={() => { setActiveTab("sends"); setSendFilter(card.filter); }}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors hover:bg-muted/50",
              activeTab === "sends" && sendFilter === card.filter && "ring-2 ring-primary"
            )}
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={cn(
              "text-2xl font-semibold",
              card.label === "Failed" && card.value > 0 && "text-red-600 dark:text-red-400"
            )}>
              {card.value}
              {card.pctVal && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  ({card.pctVal})
                </span>
              )}
            </p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== "sends") setSendFilter("all"); }}>
        <TabsList>
          <TabsTrigger value="steps">
            <FileText className="mr-1.5 size-4" />
            Steps
          </TabsTrigger>
          <TabsTrigger value="audience">
            <Users className="mr-1.5 size-4" />
            Audience
          </TabsTrigger>
          <TabsTrigger value="sends">
            <Send className="mr-1.5 size-4" />
            Sends
          </TabsTrigger>
        </TabsList>

        {/* Steps tab */}
        <TabsContent value="steps" className="mt-4">
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No steps configured for this campaign.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {renderEditOverlay()}
              {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-4 rounded-xl border p-4"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {step.order}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="font-medium">{step.subject}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {step.body_html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").slice(0, 150)}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {step.delay_hours === 0
                            ? "Send immediately"
                            : step.delay_hours < 1
                              ? `${Math.round(step.delay_hours * 60)}m delay`
                              : step.delay_hours % 1 !== 0
                                ? `${Math.round(step.delay_hours * 60)}m delay`
                                : `${step.delay_hours}h delay`}
                        </span>
                      </div>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => startEditing(step)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                  </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Audience tab */}
        <TabsContent value="audience" className="mt-4">
          {!filter ||
          Object.values(filter).every(
            (v) =>
              v === undefined ||
              v === null ||
              v === "" ||
              (Array.isArray(v) && v.length === 0)
          ) ? (
            <p className="text-sm text-muted-foreground">
              All contacts with email (no filters applied).
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {filter.funnel_id && (
                <div className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                  <span className="font-medium">Funnel:</span>
                  <span className="text-muted-foreground">
                    {lookups.funnelMap[filter.funnel_id] ?? filter.funnel_id}
                  </span>
                </div>
              )}
              {filter.stage_id && (
                <div className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                  <span className="font-medium">Stage:</span>
                  <span className="text-muted-foreground">
                    {lookups.stageMap[filter.stage_id] ?? filter.stage_id}
                  </span>
                </div>
              )}
              {filter.assigned_to && (
                <div className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                  <span className="font-medium">Assigned to:</span>
                  <span className="text-muted-foreground">
                    {lookups.memberMap[filter.assigned_to] ??
                      filter.assigned_to}
                  </span>
                </div>
              )}
              {filter.source && (
                <div className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                  <span className="font-medium">Source:</span>
                  <span className="capitalize text-muted-foreground">
                    {filter.source}
                  </span>
                </div>
              )}
              {filter.tags && filter.tags.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                  <span className="font-medium">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {filter.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Sends tab */}
        <TabsContent value="sends" className="mt-4">
          {sendFilter !== "all" && (
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs capitalize">
                Filtered: {sendFilter}
              </Badge>
              <button
                onClick={() => setSendFilter("all")}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear filter
              </button>
            </div>
          )}
          {sends.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sends yet. Messages will appear here once the campaign is
              activated.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Contact
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Email
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Status
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Sent
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Opened
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Clicked
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sends.filter((send) => {
                    if (sendFilter === "all") return true;
                    if (sendFilter === "sent") return send.status !== "queued" && send.status !== "failed";
                    if (sendFilter === "opened") return send.status === "opened" || send.status === "clicked";
                    if (sendFilter === "clicked") return send.status === "clicked";
                    if (sendFilter === "failed") return send.status === "failed" || send.status === "bounced";
                    return true;
                  }).map((send) => {
                    const name = send.contacts
                      ? [send.contacts.first_name, send.contacts.last_name]
                          .filter(Boolean)
                          .join(" ") || "\u2014"
                      : "\u2014";
                    return (
                      <TableRow key={send.id} className="h-12 cursor-pointer hover:bg-muted/50" onClick={() => setViewingSend(send)}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {send.contacts?.email ?? "\u2014"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-xs font-medium capitalize border-0",
                              SEND_STATUS_STYLES[send.status]
                            )}
                          >
                            {send.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {send.sent_at ? formatDateTime(send.sent_at) : "\u2014"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {send.opened_at
                            ? formatDateTime(send.opened_at)
                            : "\u2014"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {send.clicked_at
                            ? formatDateTime(send.clicked_at)
                            : "\u2014"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Send detail dialog */}
      <Dialog open={viewingSend !== null} onOpenChange={(open) => !open && setViewingSend(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {viewingSend && (() => {
            const step = viewingSend.step_id ? steps.find((s) => s.id === viewingSend.step_id) : null;
            const contactName = viewingSend.contacts
              ? [viewingSend.contacts.first_name, viewingSend.contacts.last_name].filter(Boolean).join(" ") || viewingSend.contacts.email
              : "Unknown";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">
                    Email to {contactName}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn("text-xs font-medium capitalize border-0", SEND_STATUS_STYLES[viewingSend.status])}>
                      {viewingSend.status}
                    </Badge>
                    {viewingSend.sent_at && (
                      <span className="text-xs text-muted-foreground">
                        Sent {formatDateTime(viewingSend.sent_at)}
                      </span>
                    )}
                  </div>
                </DialogHeader>
                {step ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                      <p className="text-sm font-medium">{step.subject}</p>
                    </div>
                    <div className="rounded-lg border bg-white dark:bg-card">
                      <div className="p-4">
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-sm"
                          dangerouslySetInnerHTML={{ __html: step.body_html }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Email content not available.
                  </p>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete campaign?"
        description="This will permanently delete the campaign and all associated sends. This action cannot be undone."
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}

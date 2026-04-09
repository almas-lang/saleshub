"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type {
  WACampaign,
  WAStep,
  WASendStatus,
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

const SEND_STATUS_STYLES: Record<WASendStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  delivered:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  read: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

interface SendWithContact {
  id: string;
  contact_id: string;
  step_id: string | null;
  status: WASendStatus;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  contacts: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string;
  } | null;
}

interface CampaignDetailProps {
  campaign: WACampaign;
  steps: WAStep[];
  sends: SendWithContact[];
  stats: {
    recipient_count: number;
    sent_count: number;
    delivered_count: number;
    read_count: number;
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

type SendFilter = "all" | "delivered" | "read" | "failed";

export function CampaignDetail({
  campaign,
  steps,
  sends,
  stats,
  lookups,
}: CampaignDetailProps) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("steps");
  const [sendFilter, setSendFilter] = useState<SendFilter>("all");
  const [viewingSend, setViewingSend] = useState<SendWithContact | null>(null);

  async function handleTogglePause() {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    setLoading(true);
    const result = await safeFetch(
      `/api/campaigns/whatsapp?id=${campaign.id}`,
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
      `/api/campaigns/whatsapp?id=${campaign.id}`,
      { method: "DELETE" }
    );
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Campaign deleted");
    router.push("/whatsapp");
  }

  const filter = campaign.audience_filter as AudienceFilter | null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link href="/whatsapp">
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
          {(campaign.status === "draft" || campaign.status === "paused") && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/whatsapp/campaigns/${campaign.id}/edit`}>
                <Pencil className="mr-2 size-4" />
                Edit Campaign
              </Link>
            </Button>
          )}
          {campaign.status === "draft" && (
            <Button
              size="sm"
              onClick={async () => {
                setLoading(true);
                const result = await safeFetch(
                  `/api/campaigns/whatsapp?id=${campaign.id}`,
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "active" }),
                  }
                );
                setLoading(false);
                if (!result.ok) { toast.error(result.error); return; }
                router.refresh();
                toast.success("Campaign activated");
              }}
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {([
          { label: "Recipients", value: stats.recipient_count, filter: "all" as SendFilter, pctVal: null },
          { label: "Delivered", value: stats.delivered_count, filter: "delivered" as SendFilter, pctVal: stats.recipient_count > 0 ? pct(stats.delivered_count, stats.recipient_count) : null },
          { label: "Read", value: stats.read_count, filter: "read" as SendFilter, pctVal: stats.recipient_count > 0 ? pct(stats.read_count, stats.recipient_count) : null },
          { label: "Failed", value: stats.failed_count, filter: "failed" as SendFilter, pctVal: null },
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
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-start gap-4 rounded-xl border p-4"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {step.order}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="font-medium">
                      {step.wa_template_name.replace(/_/g, " ")}
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
                    {Array.isArray(step.wa_template_params) &&
                      step.wa_template_params.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(step.wa_template_params as string[]).map(
                            (param, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs font-normal"
                              >
                                {`{{${i + 1}}}`} = {param}
                              </Badge>
                            )
                          )}
                        </div>
                      )}
                  </div>
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
              All contacts (no filters applied).
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
              <Badge variant="secondary" className="text-xs">
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
                        Phone
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
                        Delivered
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Read
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Error
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sends.filter((send) => {
                    if (sendFilter === "all") return true;
                    if (sendFilter === "delivered") return send.status === "delivered" || send.status === "read";
                    if (sendFilter === "read") return send.status === "read";
                    if (sendFilter === "failed") return send.status === "failed";
                    return true;
                  }).map((send) => {
                    const name = send.contacts
                      ? [send.contacts.first_name, send.contacts.last_name]
                          .filter(Boolean)
                          .join(" ") || "—"
                      : "—";
                    return (
                      <TableRow key={send.id} className="h-12 cursor-pointer hover:bg-muted/50" onClick={() => setViewingSend(send)}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {send.contacts?.phone ?? "—"}
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
                          {send.sent_at ? formatDateTime(send.sent_at) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {send.delivered_at
                            ? formatDateTime(send.delivered_at)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {send.read_at
                            ? formatDateTime(send.read_at)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-red-400 max-w-[200px] truncate" title={send.error_message ?? undefined}>
                          {send.error_message ?? "—"}
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
        <DialogContent className="max-w-md">
          {viewingSend && (() => {
            const step = viewingSend.step_id ? steps.find((s) => s.id === viewingSend.step_id) : null;
            const contactName = viewingSend.contacts
              ? [viewingSend.contacts.first_name, viewingSend.contacts.last_name].filter(Boolean).join(" ") || viewingSend.contacts.phone
              : "Unknown";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">
                    WhatsApp to {contactName}
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
                      <p className="text-xs font-medium text-muted-foreground mb-1">Template</p>
                      <p className="text-sm font-medium">{step.wa_template_name.replace(/_/g, " ")}</p>
                    </div>
                    {Array.isArray(step.wa_template_params) && step.wa_template_params.length > 0 && (
                      <div className="rounded-lg border p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Parameters</p>
                        <div className="flex flex-wrap gap-1">
                          {(step.wa_template_params as string[]).map((param, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-normal">
                              {`{{${i + 1}}}`} = {param}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {viewingSend.delivered_at && <p>Delivered: {formatDateTime(viewingSend.delivered_at)}</p>}
                      {viewingSend.read_at && <p>Read: {formatDateTime(viewingSend.read_at)}</p>}
                    </div>
                    {viewingSend.status === "failed" && viewingSend.error_message && (
                      <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-3">
                        <p className="text-xs font-medium text-red-400 mb-1">Error</p>
                        <p className="text-sm text-red-300">{viewingSend.error_message}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Message details not available.
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

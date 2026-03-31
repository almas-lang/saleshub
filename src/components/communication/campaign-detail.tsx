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
  status: WASendStatus;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.info("To edit steps, delete this campaign and create a new one. Full edit mode coming soon.");
              }}
            >
              <Pencil className="mr-2 size-4" />
              Edit Steps
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

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Recipients</p>
          <p className="text-2xl font-semibold">{stats.recipient_count}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Delivered</p>
          <p className="text-2xl font-semibold">
            {stats.delivered_count}
            {stats.recipient_count > 0 && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                ({pct(stats.delivered_count, stats.recipient_count)})
              </span>
            )}
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Read</p>
          <p className="text-2xl font-semibold">
            {stats.read_count}
            {stats.recipient_count > 0 && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                ({pct(stats.read_count, stats.recipient_count)})
              </span>
            )}
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Failed</p>
          <p
            className={cn(
              "text-2xl font-semibold",
              stats.failed_count > 0 && "text-red-600 dark:text-red-400"
            )}
          >
            {stats.failed_count}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="steps">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sends.map((send) => {
                    const name = send.contacts
                      ? [send.contacts.first_name, send.contacts.last_name]
                          .filter(Boolean)
                          .join(" ") || "—"
                      : "—";
                    return (
                      <TableRow key={send.id} className="h-12">
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

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

"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, CheckCircle2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";

interface ScheduledSend {
  id: string;
  sent_to_name: string;
  sent_to_email: string;
  scheduled_at: string | null;
  status: string;
}

interface LastSent {
  id: string;
  sent_to_name: string;
  sent_to_email: string;
  sent_at: string;
  status: string;
}

interface StatusResponse {
  scheduled: ScheduledSend[];
  last_sent: LastSent | null;
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ContractStatus({
  customerId,
  refreshKey,
}: {
  customerId: string;
  refreshKey?: number;
}) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await safeFetch<StatusResponse>(
      `/api/customers/${customerId}/contract/scheduled`
    );
    if (result.ok) setData(result.data);
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function handleCancel(sendId: string) {
    setCancellingId(sendId);
    const result = await safeFetch(
      `/api/customers/${customerId}/contract/${sendId}/cancel`,
      { method: "POST" }
    );
    setCancellingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Scheduled contract cancelled");
    void load();
  }

  if (!data) return null;
  const hasScheduled = data.scheduled.length > 0;
  const hasSent = !!data.last_sent;
  if (!hasScheduled && !hasSent) return null;

  return (
    <div className="space-y-2">
      {data.scheduled.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/20"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">
              <span className="font-medium">Contract scheduled</span>{" "}
              <span className="text-muted-foreground">
                for {s.scheduled_at ? formatAbsolute(s.scheduled_at) : "—"} → {s.sent_to_email}
              </span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0"
            onClick={() => handleCancel(s.id)}
            disabled={cancellingId === s.id}
          >
            {cancellingId === s.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <>
                <X className="mr-1 size-3.5" />
                Cancel
              </>
            )}
          </Button>
        </div>
      ))}

      {!hasScheduled && hasSent && data.last_sent && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate">
            <span className="font-medium">Contract sent</span>{" "}
            <span className="text-muted-foreground">
              {formatRelative(data.last_sent.sent_at)} to {data.last_sent.sent_to_email}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

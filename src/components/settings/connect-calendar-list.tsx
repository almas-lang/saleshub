"use client";

import { useState } from "react";
import { Check, Loader2, Calendar, Unplug } from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Member {
  id: string;
  name: string;
  email: string | null;
  google_calendar_connected: boolean;
}

export function ConnectCalendarList({ members }: { members: Member[] }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleConnect(memberId: string) {
    setLoading(memberId);
    const result = await safeFetch<{ url: string }>(
      `/api/integrations/google/connect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMemberId: memberId }),
      }
    );
    setLoading(null);

    if (result.ok) {
      window.location.href = result.data.url;
    } else {
      toast.error(result.error || "Failed to generate auth URL");
    }
  }

  async function handleDisconnect(memberId: string) {
    setLoading(memberId);
    const result = await safeFetch(
      `/api/integrations/google/connect`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMemberId: memberId }),
      }
    );
    setLoading(null);

    if (result.ok) {
      toast.success("Disconnected");
      window.location.reload();
    } else {
      toast.error(result.error || "Failed to disconnect");
    }
  }

  return (
    <div className="space-y-3">
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between rounded-lg border bg-card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{m.name}</p>
              {m.email && (
                <p className="text-xs text-muted-foreground">{m.email}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {m.google_calendar_connected && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <Check className="size-3" />
                Connected
              </Badge>
            )}
            {loading === m.id ? (
              <Button size="sm" disabled>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Loading...
              </Button>
            ) : m.google_calendar_connected ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDisconnect(m.id)}
              >
                <Unplug className="mr-1.5 size-3.5" />
                Disconnect
              </Button>
            ) : (
              <Button size="sm" onClick={() => handleConnect(m.id)}>
                Connect Calendar
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

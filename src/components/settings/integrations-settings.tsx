"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function IntegrationsSettings({
  initialConnected,
}: {
  initialConnected: boolean;
}) {
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(initialConnected);
  const [loading, setLoading] = useState(false);

  // Handle OAuth callback query params
  useEffect(() => {
    const google = searchParams.get("google");
    const error = searchParams.get("error");

    if (google === "connected") {
      setConnected(true);
      toast.success("Google Calendar connected successfully");
      // Clean URL
      window.history.replaceState({}, "", "/settings/integrations");
    } else if (error) {
      const messages: Record<string, string> = {
        google_denied: "Google Calendar access was denied",
        google_failed: "Failed to connect Google Calendar",
        missing_params: "Invalid callback — missing parameters",
      };
      toast.error(messages[error] ?? "Something went wrong");
      window.history.replaceState({}, "", "/settings/integrations");
    }
  }, [searchParams]);

  async function handleConnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/google", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Failed to get authorization URL");
        setLoading(false);
      }
    } catch {
      toast.error("Failed to connect Google Calendar");
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/google", {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setConnected(false);
        toast.success("Google Calendar disconnected");
      } else {
        toast.error(data.error ?? "Failed to disconnect");
      }
    } catch {
      toast.error("Failed to disconnect Google Calendar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
            <Calendar className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Google Calendar</h3>
            <p className="text-sm text-muted-foreground">
              Sync availability and create events with Meet links
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {connected && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
              Connected
            </Badge>
          )}

          {connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={handleConnect} disabled={loading}>
              {loading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Connect Google Calendar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

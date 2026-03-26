"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, Loader2, MessageCircle, Mail, CreditCard, IndianRupee, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface IntegrationsSettingsProps {
  initialConnected: boolean;
  whatsappDisplay?: string;
  emailDomain?: string;
  cashfreeConfigured?: boolean;
  stripeConfigured?: boolean;
  metaAdsConfigured?: boolean;
}

export function IntegrationsSettings({
  initialConnected,
  whatsappDisplay,
  emailDomain,
  cashfreeConfigured,
  stripeConfigured,
  metaAdsConfigured,
}: IntegrationsSettingsProps) {
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
        window.location.assign(data.url);
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
    <div className="space-y-4">
      {/* Google Calendar */}
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

      {/* WhatsApp */}
      {whatsappDisplay && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                <MessageCircle className="size-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">WhatsApp Business</h3>
                <p className="text-sm text-muted-foreground">
                  Connected as {whatsappDisplay}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
              Connected
            </Badge>
          </div>
        </div>
      )}

      {/* Email (Resend) */}
      {emailDomain && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                <Mail className="size-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Email (Resend)</h3>
                <p className="text-sm text-muted-foreground">
                  Sending from {emailDomain}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
              Connected
            </Badge>
          </div>
        </div>
      )}
      {/* Cashfree */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
              <IndianRupee className="size-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Cashfree</h3>
              <p className="text-sm text-muted-foreground">
                Payment links for Indian payments (UPI, Cards)
              </p>
              {!cashfreeConfigured && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in your environment variables.
                </p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className={cashfreeConfigured ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}>
            {cashfreeConfigured ? "Configured" : "Not configured"}
          </Badge>
        </div>
      </div>

      {/* Stripe */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
              <CreditCard className="size-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Stripe</h3>
              <p className="text-sm text-muted-foreground">
                International payment processing
              </p>
              {!stripeConfigured && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in your environment variables.
                </p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className={stripeConfigured ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}>
            {stripeConfigured ? "Configured" : "Not configured"}
          </Badge>
        </div>
      </div>

      {/* Meta Ads */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
              <Megaphone className="size-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Meta Ads</h3>
              <p className="text-sm text-muted-foreground">
                Import ad spend data from Facebook/Instagram
              </p>
              {!metaAdsConfigured && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in your environment variables.
                </p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className={metaAdsConfigured ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}>
            {metaAdsConfigured ? "Configured" : "Not configured"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

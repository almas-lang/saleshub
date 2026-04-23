"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Loader2, Clock, X } from "lucide-react";
import { safeFetch } from "@/lib/fetch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SendContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  initialName: string;
  initialEmail: string;
  initialPhone?: string | null;
  onSent?: () => void;
}

interface PreviewResponse {
  subject: string;
  html: string;
}

interface ScheduledContract {
  id: string;
  sent_to_name: string;
  sent_to_email: string;
  scheduled_at: string | null;
  status: string;
}

function toLocalDatetimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000); // +1 hour
  d.setMinutes(0, 0, 0);
  return toLocalDatetimeInputValue(d);
}

function formatScheduled(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SendContractDialog({
  open,
  onOpenChange,
  customerId,
  initialName,
  initialEmail,
  initialPhone,
  onSent,
}: SendContractDialogProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<"email" | "pdf">("email");

  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [scheduleValue, setScheduleValue] = useState<string>(defaultScheduleValue());
  const [scheduled, setScheduled] = useState<ScheduledContract[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  // Reset fields when opened for a different customer
  useEffect(() => {
    if (open) {
      setName(initialName);
      setEmail(initialEmail);
      setPhone(initialPhone ?? "");
      setSendMode("now");
      setScheduleValue(defaultScheduleValue());
      void loadScheduled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName, initialEmail, initialPhone, customerId]);

  const loadScheduled = useCallback(async () => {
    const result = await safeFetch<{ scheduled: ScheduledContract[] }>(
      `/api/customers/${customerId}/contract/scheduled`
    );
    if (result.ok) setScheduled(result.data.scheduled ?? []);
  }, [customerId]);

  // Debounced preview refresh (both email HTML and filled PDF)
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refreshEmailPreview();
      void refreshPdfPreview();
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, name, customerId, sendMode, scheduleValue]);

  // Revoke the object URL when dialog closes or component unmounts
  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, []);

  async function refreshEmailPreview() {
    setLoadingPreview(true);
    const result = await safeFetch<PreviewResponse>(
      `/api/customers/${customerId}/contract/preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      }
    );
    setLoadingPreview(false);
    if (result.ok) {
      setPreview(result.data);
    }
  }

  async function refreshPdfPreview() {
    setLoadingPdf(true);
    let scheduledAtIso: string | null = null;
    if (sendMode === "later" && scheduleValue) {
      const d = new Date(scheduleValue);
      if (!Number.isNaN(d.getTime())) {
        scheduledAtIso = d.toISOString();
      }
    }
    try {
      const res = await fetch(`/api/customers/${customerId}/contract/pdf-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scheduled_at: scheduledAtIso }),
      });
      if (!res.ok) {
        setLoadingPdf(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = url;
      setPdfUrl(url);
    } catch {
      // swallow — preview is best-effort
    }
    setLoadingPdf(false);
  }

  async function handleSend() {
    if (!email.trim()) {
      toast.error("Email is required to send the contract");
      return;
    }

    let scheduledAtIso: string | null = null;
    if (sendMode === "later") {
      if (!scheduleValue) {
        toast.error("Pick a date and time");
        return;
      }
      const d = new Date(scheduleValue);
      if (Number.isNaN(d.getTime())) {
        toast.error("Invalid date");
        return;
      }
      if (d.getTime() <= Date.now()) {
        toast.error("Scheduled time must be in the future");
        return;
      }
      scheduledAtIso = d.toISOString();
    }

    setSending(true);
    const result = await safeFetch<{ scheduled?: boolean; scheduled_at?: string | null }>(
      `/api/customers/${customerId}/contract/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          scheduled_at: scheduledAtIso,
        }),
      }
    );
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (scheduledAtIso) {
      toast.success(
        `Contract scheduled for ${formatScheduled(scheduledAtIso)} → ${email}`
      );
    } else {
      toast.success(`Contract sent to ${email}`);
    }
    onOpenChange(false);
    onSent?.();
  }

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
    setScheduled((prev) => prev.filter((s) => s.id !== sendId));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle>Send Contract</DialogTitle>
          <DialogDescription>
            Review the email below. Edit the recipient details if needed, then send.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[260px_1fr] max-h-[70vh]">
          {/* Left: editable fields */}
          <div className="space-y-3 border-b md:border-b-0 md:border-r bg-muted/30 p-5 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Recipient name"
              />
              <p className="text-[11px] text-muted-foreground">
                Used in the email greeting.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
              <p className="text-[11px] text-muted-foreground">
                Contract will be sent here.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (for records)"
              />
              <p className="text-[11px] text-muted-foreground">
                Saved with the send record.
              </p>
            </div>

            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs">When to send</Label>
              <div className="flex overflow-hidden rounded-md border">
                <button
                  type="button"
                  className={`flex-1 px-2 py-1 text-xs transition-colors ${
                    sendMode === "now"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                  onClick={() => setSendMode("now")}
                >
                  Send now
                </button>
                <button
                  type="button"
                  className={`flex-1 px-2 py-1 text-xs transition-colors ${
                    sendMode === "later"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                  onClick={() => setSendMode("later")}
                >
                  Schedule
                </button>
              </div>
              {sendMode === "later" && (
                <Input
                  type="datetime-local"
                  value={scheduleValue}
                  min={toLocalDatetimeInputValue(new Date(Date.now() + 60_000))}
                  onChange={(e) => setScheduleValue(e.target.value)}
                />
              )}
            </div>

            {scheduled.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="size-3" /> Scheduled ({scheduled.length})
                </Label>
                <ul className="space-y-1">
                  {scheduled.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-2 rounded border bg-background px-2 py-1.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {formatScheduled(s.scheduled_at)}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {s.sent_to_email}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0"
                        onClick={() => handleCancel(s.id)}
                        disabled={cancellingId === s.id}
                        aria-label="Cancel scheduled contract"
                      >
                        {cancellingId === s.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <X className="size-3" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: email + pdf preview tabs */}
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "email" | "pdf")}
            className="flex min-h-[420px] flex-col bg-muted/20"
          >
            <div className="flex items-center justify-between border-b bg-background px-3 py-2">
              <TabsList className="h-8">
                <TabsTrigger value="email" className="text-xs">Email</TabsTrigger>
                <TabsTrigger value="pdf" className="text-xs">Contract PDF</TabsTrigger>
              </TabsList>
              {tab === "email" && preview && (
                <span className="truncate text-xs text-muted-foreground">
                  <span className="mr-1">Subject:</span>
                  <span className="font-medium text-foreground">{preview.subject}</span>
                </span>
              )}
            </div>

            <TabsContent value="email" className="flex-1 data-[state=inactive]:hidden mt-0">
              {loadingPreview && !preview ? (
                <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Rendering preview...
                </div>
              ) : preview ? (
                <iframe
                  title="Contract email preview"
                  srcDoc={preview.html}
                  sandbox=""
                  className="h-full min-h-[420px] w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-muted-foreground">
                  Preview unavailable
                </div>
              )}
            </TabsContent>

            <TabsContent value="pdf" className="flex-1 data-[state=inactive]:hidden mt-0">
              {loadingPdf && !pdfUrl ? (
                <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Rendering contract...
                </div>
              ) : pdfUrl ? (
                <iframe
                  title="Contract PDF preview"
                  src={pdfUrl}
                  className="h-full min-h-[420px] w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-muted-foreground">
                  PDF unavailable
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t bg-background px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !email.trim()}>
            {sending ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                {sendMode === "later" ? "Scheduling..." : "Sending..."}
              </>
            ) : sendMode === "later" ? (
              <>
                <Clock className="mr-1.5 size-3.5" />
                Schedule contract
              </>
            ) : (
              <>
                <Send className="mr-1.5 size-3.5" />
                Send contract
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

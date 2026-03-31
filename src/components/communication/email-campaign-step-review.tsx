"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeFetch } from "@/lib/fetch";
import type {
  AudienceFilter,
  EmailStepDraft,
  CampaignType,
} from "@/types/campaigns";

interface FilterOption {
  id: string;
  name: string;
}

interface EmailCampaignStepReviewProps {
  name: string;
  type: CampaignType;
  filter: AudienceFilter;
  steps: EmailStepDraft[];
  audienceCount: number;
  saving: boolean;
  onSave: (activate: boolean) => void;
  funnels: FilterOption[];
  stages: { id: string; name: string; funnel_id: string }[];
  teamMembers: FilterOption[];
  sources: string[];
}

const TYPE_LABELS: Record<CampaignType, string> = {
  one_time: "One-time Broadcast",
  drip: "Drip Sequence",
  newsletter: "Newsletter",
};

export function EmailCampaignStepReview({
  name,
  type,
  filter,
  steps,
  audienceCount,
  saving,
  onSave,
  funnels,
  stages,
  teamMembers,
}: EmailCampaignStepReviewProps) {
  const funnelName = filter.funnel_id
    ? funnels.find((f) => f.id === filter.funnel_id)?.name
    : null;
  const stageName = filter.stage_id
    ? stages.find((s) => s.id === filter.stage_id)?.name
    : null;
  const assigneeName = filter.assigned_to
    ? teamMembers.find((m) => m.id === filter.assigned_to)?.name
    : null;

  return (
    <div className="space-y-6">
      {/* Campaign details */}
      <div className="rounded-lg border p-4 space-y-2">
        <h3 className="text-sm font-semibold">Campaign Details</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground">Type</span>
          <span className="font-medium">{TYPE_LABELS[type]}</span>
        </div>
      </div>

      {/* Audience */}
      <div className="rounded-lg border p-4 space-y-2">
        <h3 className="text-sm font-semibold">Audience</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {type === "drip" && (
            <>
              <span className="text-muted-foreground">Enrollment</span>
              <span className="font-medium">
                {filter.enrollment_type === "existing"
                  ? "Existing contacts only"
                  : filter.enrollment_type === "both"
                    ? "Existing contacts + new leads"
                    : "New leads only"}
              </span>
            </>
          )}
          {(type !== "drip" || filter.enrollment_type !== "new_leads") && (
            <>
              <span className="text-muted-foreground">
                {type === "drip" ? "Existing contacts" : "Total recipients"}
              </span>
              <span className="font-medium">
                {audienceCount + (filter.extra_emails?.length ?? 0)}
                {(filter.extra_emails?.length ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    ({audienceCount} from filters + {filter.extra_emails!.length} additional)
                  </span>
                )}
              </span>
            </>
          )}
          {filter.source && (
            <>
              <span className="text-muted-foreground">Source</span>
              <span className="font-medium">{filter.source}</span>
            </>
          )}
          {funnelName && (
            <>
              <span className="text-muted-foreground">Funnel</span>
              <span className="font-medium">{funnelName}</span>
            </>
          )}
          {stageName && (
            <>
              <span className="text-muted-foreground">Stage</span>
              <span className="font-medium">{stageName}</span>
            </>
          )}
          {assigneeName && (
            <>
              <span className="text-muted-foreground">Assigned to</span>
              <span className="font-medium">{assigneeName}</span>
            </>
          )}
          {filter.tags && filter.tags.length > 0 && (
            <>
              <span className="text-muted-foreground">Tags</span>
              <span className="font-medium">{filter.tags.join(", ")}</span>
            </>
          )}
          {filter.extra_emails && filter.extra_emails.length > 0 && (
            <>
              <span className="text-muted-foreground">Additional recipients</span>
              <span className="font-medium">{filter.extra_emails.length} email{filter.extra_emails.length !== 1 ? "s" : ""}</span>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          Messages ({steps.length} step{steps.length !== 1 ? "s" : ""})
        </h3>
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.subject || "(no subject)"}</p>
              {s.preview_text && (
                <p className="mt-0.5 text-xs text-muted-foreground italic">
                  {s.preview_text}
                </p>
              )}
              {s.body_html && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {s.body_html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").slice(0, 120)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {i === 0
                  ? "Immediately"
                  : `${s.delay_hours}h after previous step`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Test email */}
      <TestEmailSection steps={steps} />

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          disabled={saving}
          onClick={() => onSave(false)}
        >
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save as Draft
        </Button>
        <Button
          className="flex-1"
          disabled={saving}
          onClick={() => onSave(true)}
        >
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save &amp; Activate
        </Button>
      </div>
    </div>
  );
}

function TestEmailSection({ steps }: { steps: EmailStepDraft[] }) {
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSendTest() {
    if (!testEmail.trim()) {
      toast.error("Enter an email address");
      return;
    }
    if (steps.length === 0 || !steps[0].subject) {
      toast.error("No steps to test");
      return;
    }

    setSending(true);

    // Send step 1 as a test
    const s = steps[0];
    const result = await safeFetch("/api/campaigns/email/test-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: testEmail.trim(),
        subject: s.subject,
        body_html: s.body_html,
        preview_text: s.preview_text,
      }),
    });

    setSending(false);

    if (!result.ok) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to send test email");
      return;
    }

    toast.success(`Test email sent to ${testEmail}`);
  }

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3">
      <h3 className="text-sm font-semibold">Send Test Email</h3>
      <p className="text-xs text-muted-foreground">
        Send step 1 to a test address to preview how it looks in an inbox.
      </p>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="test@example.com"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleSendTest()}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSendTest}
          disabled={sending || !testEmail.trim()}
        >
          {sending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />}
          Send Test
        </Button>
      </div>
    </div>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          <span className="text-muted-foreground">Total recipients</span>
          <span className="font-medium">
            {audienceCount + (filter.extra_emails?.length ?? 0)}
            {(filter.extra_emails?.length ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground font-normal ml-1">
                ({audienceCount} from filters + {filter.extra_emails!.length} additional)
              </span>
            )}
          </span>
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
              {s.body_html && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {s.body_html.replace(/<[^>]*>/g, "").slice(0, 120)}
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

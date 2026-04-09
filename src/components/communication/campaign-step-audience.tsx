"use client";

import { useState } from "react";
import { Info, Loader2, UserPlus, Users, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AudienceFilter, EnrollmentType } from "@/types/campaigns";

interface FilterOption {
  id: string;
  name: string;
}

interface StageOption extends FilterOption {
  funnel_id: string;
}

interface CampaignStepAudienceProps {
  filter: AudienceFilter;
  onFilterChange: (filter: AudienceFilter) => void;
  sources: string[];
  funnels: FilterOption[];
  stages: StageOption[];
  teamMembers: FilterOption[];
  audienceCount: number;
  countLoading: boolean;
  /** Channel hint for the info banner. Defaults to "whatsapp". */
  channel?: "whatsapp" | "email";
  /** Campaign type — drip campaigns show enrollment type selector. */
  campaignType?: "drip" | "one_time" | "newsletter";
}

const ENROLLMENT_OPTIONS: {
  value: EnrollmentType;
  label: string;
  description: string;
  icon: typeof Zap;
}[] = [
  {
    value: "new_leads",
    label: "New Leads Only",
    description: "Auto-enroll new leads as they come in",
    icon: Zap,
  },
  {
    value: "existing",
    label: "Existing Contacts",
    description: "Enroll contacts from your database right now",
    icon: Users,
  },
  {
    value: "both",
    label: "Both",
    description: "Enroll existing contacts now + auto-enroll new leads",
    icon: UserPlus,
  },
];

export function CampaignStepAudience({
  filter,
  onFilterChange,
  sources,
  funnels,
  stages,
  teamMembers,
  audienceCount,
  countLoading,
  channel = "whatsapp",
  campaignType,
}: CampaignStepAudienceProps) {
  const filteredStages = filter.funnel_id
    ? stages.filter((s) => s.funnel_id === filter.funnel_id)
    : [];

  const isDrip = campaignType === "drip";
  const enrollmentType = filter.enrollment_type ?? "new_leads";
  const showCount = !isDrip || enrollmentType !== "new_leads";
  const showExtraEmails = (!isDrip || enrollmentType !== "new_leads") && channel === "email";
  const showArchived = !isDrip || enrollmentType !== "new_leads";
  const useAnyLabels = isDrip && enrollmentType === "new_leads";

  function handleChange(key: keyof AudienceFilter, value: string) {
    const next = { ...filter };
    if (key === "tags") {
      next.tags = value
        ? value.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;
    } else {
      (next as Record<string, string | undefined>)[key] = value || undefined;
    }
    // Clear stage when funnel changes
    if (key === "funnel_id") {
      next.stage_id = undefined;
    }
    onFilterChange(next);
  }

  function handleEnrollmentChange(type: EnrollmentType) {
    onFilterChange({ ...filter, enrollment_type: type });
  }

  function getInfoText() {
    if (!isDrip) {
      return channel === "email"
        ? "Email campaigns require an email address \u2014 only contacts with email addresses are counted."
        : "WhatsApp requires a phone number \u2014 only contacts with phone numbers are counted.";
    }
    switch (enrollmentType) {
      case "new_leads":
        return "New leads matching these criteria will automatically enter this sequence after activation.";
      case "existing":
        return "Matching contacts from your database will be enrolled when you activate this campaign.";
      case "both":
        return "Existing contacts will be enrolled on activation. New leads will auto-enroll going forward.";
    }
  }

  const allLabel = useAnyLabels ? "Any" : "All";

  return (
    <div className="space-y-6">
      {/* Enrollment type selector (drip only) */}
      {isDrip && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Who should enter this sequence?</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {ENROLLMENT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = enrollmentType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleEnrollmentChange(opt.value)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("size-4", selected ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", selected ? "text-primary" : "text-foreground")}>
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
        <Info className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {getInfoText()}
        </p>
      </div>

      {/* Filter label context */}
      {isDrip && (
        <p className="text-xs text-muted-foreground">
          {enrollmentType === "new_leads"
            ? "Use the filters below to narrow which incoming leads qualify for this sequence."
            : "Use the filters below to select which contacts to enroll."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{useAnyLabels ? "From Source" : "Source"}</Label>
          <Select
            value={filter.source || "all"}
            onValueChange={(v) => handleChange("source", v === "all" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`${allLabel} Sources`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{allLabel} Sources</SelectItem>
              {showExtraEmails && (
                <SelectItem value="__custom_only__">None (custom emails only)</SelectItem>
              )}
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{useAnyLabels ? "In Funnel" : "Funnel"}</Label>
          <Select
            value={filter.funnel_id || "all"}
            onValueChange={(v) =>
              handleChange("funnel_id", v === "all" ? "" : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={`${allLabel} Funnels`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{allLabel} Funnels</SelectItem>
              {funnels.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{useAnyLabels ? "At Stage" : "Stage"}</Label>
          <Select
            value={filter.stage_id || "all"}
            onValueChange={(v) =>
              handleChange("stage_id", v === "all" ? "" : v)
            }
            disabled={!filter.funnel_id}
          >
            <SelectTrigger>
              <SelectValue placeholder={`${allLabel} Stages`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{allLabel} Stages</SelectItem>
              {filteredStages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Assigned To</Label>
          <Select
            value={filter.assigned_to || "all"}
            onValueChange={(v) =>
              handleChange("assigned_to", v === "all" ? "" : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={`${allLabel} Members`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{allLabel} Members</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags (comma-separated)</Label>
        <Input
          placeholder="e.g. vip, hot-lead"
          value={filter.tags?.join(", ") ?? ""}
          onChange={(e) => handleChange("tags", e.target.value)}
        />
      </div>

      {/* Additional recipients (email only, when enrollment includes existing) */}
      {showExtraEmails && (
        <ExtraEmailsField filter={filter} onFilterChange={onFilterChange} />
      )}

      {/* Include archived toggle */}
      {showArchived && (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="include-archived" className="text-sm font-medium">Include archived contacts</Label>
            <p className="text-xs text-muted-foreground">Archived contacts are excluded by default</p>
          </div>
          <Switch
            id="include-archived"
            checked={filter.include_archived ?? false}
            onCheckedChange={(checked) =>
              onFilterChange({ ...filter, include_archived: checked || undefined })
            }
          />
        </div>
      )}

      {/* Live count card */}
      {showCount && (
        <div className="rounded-lg border bg-muted/30 p-4 text-center">
          {countLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Counting contacts...
              </span>
            </div>
          ) : (
            <p className="text-sm font-medium">
              <span className="text-2xl font-bold tabular-nums">
                {audienceCount + (filter.extra_emails?.length ?? 0)}
              </span>{" "}
              {isDrip && enrollmentType === "existing"
                ? "contacts will be enrolled on activation"
                : isDrip && enrollmentType === "both"
                  ? "existing contacts will be enrolled + new leads going forward"
                  : `matching contact${(audienceCount + (filter.extra_emails?.length ?? 0)) !== 1 ? "s" : ""}`}
              {(filter.extra_emails?.length ?? 0) > 0 && (
                <span className="text-muted-foreground font-normal">
                  {" "}({audienceCount} from filters + {filter.extra_emails!.length} additional)
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ExtraEmailsField({
  filter,
  onFilterChange,
}: {
  filter: AudienceFilter;
  onFilterChange: (filter: AudienceFilter) => void;
}) {
  const [raw, setRaw] = useState(filter.extra_emails?.join(", ") ?? "");

  function parseAndSync(text: string) {
    const emails = text
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onFilterChange({ ...filter, extra_emails: emails.length > 0 ? emails : undefined });
  }

  return (
    <div className="space-y-2">
      <Label>Additional Recipients (optional)</Label>
      <Textarea
        placeholder="Paste email addresses, one per line or comma-separated"
        rows={3}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => parseAndSync(raw)}
      />
      <p className="text-xs text-muted-foreground">
        These addresses will receive the campaign even if they don&apos;t match the filters above.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Info, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { AudienceFilter } from "@/types/campaigns";

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
}

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
}: CampaignStepAudienceProps) {
  const filteredStages = filter.funnel_id
    ? stages.filter((s) => s.funnel_id === filter.funnel_id)
    : [];

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

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
        <Info className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {channel === "email"
            ? "Email campaigns require an email address \u2014 only contacts with email addresses are counted."
            : "WhatsApp requires a phone number \u2014 only contacts with phone numbers are counted."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Source</Label>
          <Select
            value={filter.source || "all"}
            onValueChange={(v) => handleChange("source", v === "all" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {channel === "email" && (
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
          <Label>Funnel</Label>
          <Select
            value={filter.funnel_id || "all"}
            onValueChange={(v) =>
              handleChange("funnel_id", v === "all" ? "" : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Funnels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Funnels</SelectItem>
              {funnels.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Stage</Label>
          <Select
            value={filter.stage_id || "all"}
            onValueChange={(v) =>
              handleChange("stage_id", v === "all" ? "" : v)
            }
            disabled={!filter.funnel_id}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
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
              <SelectValue placeholder="All Members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
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

      {/* Additional recipients (email only) */}
      {channel === "email" && (
        <ExtraEmailsField filter={filter} onFilterChange={onFilterChange} />
      )}

      {/* Live count card */}
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
            matching contact{(audienceCount + (filter.extra_emails?.length ?? 0)) !== 1 ? "s" : ""}
            {(filter.extra_emails?.length ?? 0) > 0 && (
              <span className="text-muted-foreground font-normal">
                {" "}({audienceCount} from filters + {filter.extra_emails!.length} additional)
              </span>
            )}
          </p>
        )}
      </div>
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

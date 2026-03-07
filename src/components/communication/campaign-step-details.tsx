"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CampaignType } from "@/types/campaigns";

const CAMPAIGN_TYPES: { value: CampaignType; label: string; description: string }[] = [
  {
    value: "one_time",
    label: "One-time Broadcast",
    description: "Send a single message to your audience right away",
  },
  {
    value: "drip",
    label: "Drip Sequence",
    description: "Multiple messages sent over time with delays",
  },
  {
    value: "newsletter",
    label: "Newsletter",
    description: "Recurring messages for ongoing engagement",
  },
];

interface CampaignStepDetailsProps {
  name: string;
  onNameChange: (name: string) => void;
  type: CampaignType;
  onTypeChange: (type: CampaignType) => void;
}

export function CampaignStepDetails({
  name,
  onNameChange,
  type,
  onTypeChange,
}: CampaignStepDetailsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="campaign-name">Campaign Name</Label>
        <Input
          id="campaign-name"
          placeholder="e.g. Welcome Sequence"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={100}
        />
      </div>

      <div className="space-y-3">
        <Label>Campaign Type</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {CAMPAIGN_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => onTypeChange(ct.value)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                type === ct.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              )}
            >
              <p className="text-sm font-medium">{ct.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ct.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  ImportConfig,
  ImportType,
  DuplicateHandling,
  FormResponseConfig,
  FormResponseDuplicateHandling,
} from "@/types/import";

interface StepConfigureProps {
  config: ImportConfig;
  onConfigChange: (config: ImportConfig) => void;
  funnels: { id: string; name: string }[];
  stages: { id: string; name: string; funnel_id: string; order: number }[];
  teamMembers: { id: string; name: string }[];
  importType: ImportType;
  formResponseConfig: FormResponseConfig;
  onFormResponseConfigChange: (config: FormResponseConfig) => void;
}

const DUPLICATE_OPTIONS: {
  value: DuplicateHandling;
  label: string;
  description: string;
}[] = [
  {
    value: "skip",
    label: "Skip duplicates",
    description: "If a matching email or phone exists, skip the row.",
  },
  {
    value: "update",
    label: "Update existing",
    description: "Merge imported fields into the existing contact.",
  },
  {
    value: "create_always",
    label: "Always create",
    description: "Create a new contact for every row, even if duplicates exist.",
  },
];

const FORM_RESPONSE_DUPLICATE_OPTIONS: {
  value: FormResponseDuplicateHandling;
  label: string;
  description: string;
}[] = [
  {
    value: "skip",
    label: "Skip if exists",
    description: "Skip if a form response already exists for this contact.",
  },
  {
    value: "create_new",
    label: "Create new response",
    description: "Always create a new form response, even if one exists.",
  },
];

export function StepConfigure({
  config,
  onConfigChange,
  funnels,
  stages,
  teamMembers,
  importType,
  formResponseConfig,
  onFormResponseConfigChange,
}: StepConfigureProps) {
  const isFormResponses = importType === "form_responses";

  const filteredStages = isFormResponses
    ? formResponseConfig.target_funnel_id
      ? stages
          .filter((s) => s.funnel_id === formResponseConfig.target_funnel_id)
          .sort((a, b) => a.order - b.order)
      : []
    : config.default_funnel_id
      ? stages
          .filter((s) => s.funnel_id === config.default_funnel_id)
          .sort((a, b) => a.order - b.order)
      : [];

  function update(partial: Partial<ImportConfig>) {
    onConfigChange({ ...config, ...partial });
  }

  function updateFormResponse(partial: Partial<FormResponseConfig>) {
    onFormResponseConfigChange({ ...formResponseConfig, ...partial });
  }

  if (isFormResponses) {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium">Configure form response import</h3>
          <p className="text-sm text-muted-foreground">
            Set the target funnel stage and duplicate handling for matched contacts.
          </p>
        </div>

        {/* Target funnel & stage */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Move matched contacts to</Label>
          <p className="text-xs text-muted-foreground">
            Contacts matched by email will be moved to this funnel stage.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Target Funnel *</Label>
              <Select
                value={formResponseConfig.target_funnel_id || "none"}
                onValueChange={(v) =>
                  updateFormResponse({
                    target_funnel_id: v === "none" ? "" : v,
                    target_stage_id: "",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select funnel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a funnel</SelectItem>
                  {funnels.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Target Stage *</Label>
              <Select
                value={formResponseConfig.target_stage_id || "none"}
                onValueChange={(v) =>
                  updateFormResponse({ target_stage_id: v === "none" ? "" : v })
                }
                disabled={!formResponseConfig.target_funnel_id}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a stage</SelectItem>
                  {filteredStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Duplicate handling */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Duplicate handling</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {FORM_RESPONSE_DUPLICATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateFormResponse({ duplicate_handling: opt.value })}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  formResponseConfig.duplicate_handling === opt.value
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {opt.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Options</Label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={formResponseConfig.trim_whitespace}
              onCheckedChange={(checked) =>
                updateFormResponse({ trim_whitespace: checked === true })
              }
            />
            <span className="text-sm">Trim whitespace from all values</span>
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium">Configure import</h3>
        <p className="text-sm text-muted-foreground">
          Set how duplicates are handled and apply default values.
        </p>
      </div>

      {/* Duplicate handling */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Duplicate handling</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {DUPLICATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ duplicate_handling: opt.value })}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                config.duplicate_handling === opt.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              )}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {opt.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Default values */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Default values</Label>
        <p className="text-xs text-muted-foreground">
          Applied to rows that don&apos;t have these fields mapped or are empty.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs">Funnel</Label>
            <Select
              value={config.default_funnel_id || "none"}
              onValueChange={(v) =>
                update({
                  default_funnel_id: v === "none" ? "" : v,
                  default_stage_id: "",
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select funnel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {funnels.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Stage</Label>
            <Select
              value={config.default_stage_id || "none"}
              onValueChange={(v) =>
                update({ default_stage_id: v === "none" ? "" : v })
              }
              disabled={!config.default_funnel_id}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {filteredStages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Assigned to</Label>
            <Select
              value={config.default_assigned_to || "none"}
              onValueChange={(v) =>
                update({ default_assigned_to: v === "none" ? "" : v })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Source</Label>
            <Input
              placeholder="e.g. CSV Import, Brevo"
              value={config.default_source}
              onChange={(e) => update({ default_source: e.target.value })}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs">Tags</Label>
            <Input
              placeholder="tag1, tag2, tag3"
              value={config.default_tags.join(", ")}
              onChange={(e) =>
                update({
                  default_tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Options</Label>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={config.normalize_phones}
              onCheckedChange={(checked) =>
                update({ normalize_phones: checked === true })
              }
            />
            <span className="text-sm">
              Normalize phone numbers (add +91 prefix for Indian numbers)
            </span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={config.trim_whitespace}
              onCheckedChange={(checked) =>
                update({ trim_whitespace: checked === true })
              }
            />
            <span className="text-sm">Trim whitespace from all values</span>
          </label>
        </div>
      </div>
    </div>
  );
}

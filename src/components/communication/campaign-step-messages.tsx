"use client";

import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { CampaignStepDraft, CampaignType } from "@/types/campaigns";
import type { WizardTemplate } from "./campaign-wizard";

interface CampaignStepMessagesProps {
  steps: CampaignStepDraft[];
  onStepsChange: (steps: CampaignStepDraft[]) => void;
  templates: WizardTemplate[];
  templatesLoading: boolean;
  campaignType: CampaignType;
}

function parseParams(bodyText: string | null): number[] {
  if (!bodyText) return [];
  const matches = bodyText.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/\D/g, ""))))].sort(
    (a, b) => a - b
  );
}

export function CampaignStepMessages({
  steps,
  onStepsChange,
  templates,
  templatesLoading,
  campaignType,
}: CampaignStepMessagesProps) {
  const isOneTime = campaignType === "one_time";

  function updateStep(index: number, partial: Partial<CampaignStepDraft>) {
    const next = [...steps];
    next[index] = { ...next[index], ...partial };
    onStepsChange(next);
  }

  function handleTemplateSelect(index: number, templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const paramSlots = parseParams(tpl.body_text);
    updateStep(index, {
      template_id: tpl.id,
      wa_template_name: tpl.name,
      wa_template_params: paramSlots.map(() => ""),
    });
  }

  function handleParamChange(
    stepIndex: number,
    paramIndex: number,
    value: string
  ) {
    const next = [...steps];
    const params = [...next[stepIndex].wa_template_params];
    params[paramIndex] = value;
    next[stepIndex] = { ...next[stepIndex], wa_template_params: params };
    onStepsChange(next);
  }

  function addStep() {
    onStepsChange([
      ...steps,
      {
        template_id: "",
        wa_template_name: "",
        delay_hours: 24,
        wa_template_params: [],
      },
    ]);
  }

  function removeStep(index: number) {
    onStepsChange(steps.filter((_, i) => i !== index));
  }

  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading templates...</span>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No approved templates found. Create templates in your Meta Business
          account first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step, i) => {
        const selectedTemplate = step.template_id
          ? templates.find((t) => t.id === step.template_id)
          : null;
        const paramSlots = selectedTemplate
          ? parseParams(selectedTemplate.body_text)
          : [];

        return (
          <div key={i} className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">
                  Step {i + 1}
                </span>
              </div>
              {!isOneTime && steps.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeStep(i)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={step.template_id || undefined}
                onValueChange={(v) => handleTemplateSelect(i, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate?.body_text && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Preview
                </p>
                <p className="whitespace-pre-wrap text-sm">
                  {selectedTemplate.body_text}
                </p>
              </div>
            )}

            {paramSlots.length > 0 && (
              <div className="space-y-2">
                <Label>Template Parameters</Label>
                {paramSlots.map((paramNum, pi) => (
                  <div key={paramNum} className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      {`{{${paramNum}}}`}
                    </label>
                    <Input
                      placeholder={`Value for {{${paramNum}}}`}
                      value={step.wa_template_params[pi] ?? ""}
                      onChange={(e) =>
                        handleParamChange(i, pi, e.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Delay</Label>
              {i === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Immediately (first step)
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={step.delay_hours}
                    onChange={(e) =>
                      updateStep(i, {
                        delay_hours: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    hours after previous step
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {!isOneTime && (
        <Button
          variant="outline"
          className="w-full"
          onClick={addStep}
        >
          <Plus className="mr-2 size-4" />
          Add Step
        </Button>
      )}
    </div>
  );
}

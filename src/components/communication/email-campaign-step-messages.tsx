"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmailBlockEditor } from "./email-block-editor";
import type { EmailStepDraft, CampaignType } from "@/types/campaigns";

interface EmailCampaignStepMessagesProps {
  steps: EmailStepDraft[];
  onStepsChange: (steps: EmailStepDraft[]) => void;
  campaignType: CampaignType;
}

export function EmailCampaignStepMessages({
  steps,
  onStepsChange,
  campaignType,
}: EmailCampaignStepMessagesProps) {
  const isOneTime = campaignType === "one_time";

  function updateStep(index: number, partial: Partial<EmailStepDraft>) {
    const next = [...steps];
    next[index] = { ...next[index], ...partial };
    onStepsChange(next);
  }

  function addStep() {
    onStepsChange([
      ...steps,
      { subject: "", body_html: "", delay_hours: 24 },
    ]);
  }

  function removeStep(index: number) {
    onStepsChange(steps.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {steps.map((step, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-sm font-medium">Step {i + 1}</span>
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
            <Label>Subject</Label>
            <Input
              placeholder="Email subject line..."
              value={step.subject}
              onChange={(e) => updateStep(i, { subject: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Body</Label>
            <EmailBlockEditor
              content={step.body_html}
              onChange={(html) => updateStep(i, { body_html: html })}
              placeholder="Write your email content..."
            />
          </div>

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
      ))}

      {!isOneTime && (
        <Button variant="outline" className="w-full" onClick={addStep}>
          <Plus className="mr-2 size-4" />
          Add Step
        </Button>
      )}
    </div>
  );
}

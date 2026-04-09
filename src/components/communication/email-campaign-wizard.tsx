"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { safeFetch } from "@/lib/fetch";
import type {
  AudienceFilter,
  EmailStepDraft,
  CampaignType,
  FlowData,
} from "@/types/campaigns";
import { CampaignStepDetails } from "./campaign-step-details";
import { CampaignStepAudience } from "./campaign-step-audience";
import { EmailCampaignStepMessages } from "./email-campaign-step-messages";
import { EmailCampaignStepReview } from "./email-campaign-step-review";
import { EmailDripFlowCanvas, validateEmailFlow, flowToEmailSteps, flowToEmailStepsWithBranching } from "./email-drip-flow-canvas";

interface FilterOption {
  id: string;
  name: string;
}

interface StageOption extends FilterOption {
  funnel_id: string;
  order: number;
}

export interface EmailCampaignInitialData {
  id: string;
  name: string;
  type: CampaignType;
  audience_filter: AudienceFilter | null;
  flow_data: FlowData | null;
  steps: EmailStepDraft[];
}

interface EmailCampaignWizardProps {
  funnels: FilterOption[];
  stages: StageOption[];
  teamMembers: FilterOption[];
  sources: string[];
  initialData?: EmailCampaignInitialData;
}

const STEPS = [
  { label: "Details" },
  { label: "Audience" },
  { label: "Messages" },
  { label: "Review" },
];

export function EmailCampaignWizard({
  funnels,
  stages,
  teamMembers,
  sources,
  initialData,
}: EmailCampaignWizardProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  // Determine initial step: for editing, start at Review if all data is present
  const getInitialStep = () => {
    if (!initialData) return 0;
    if (initialData.steps.length > 0 || initialData.flow_data) return 3;
    if (initialData.audience_filter) return 2;
    if (initialData.name) return 1;
    return 0;
  };
  const [step, setStep] = useState(getInitialStep);

  // Step 1 -- Details
  const [name, setName] = useState(initialData?.name ?? "");
  const [type, setType] = useState<CampaignType>(initialData?.type ?? "one_time");

  // Stop condition
  const [stopCondition, setStopCondition] = useState<{ stage_id: string; stage_name?: string } | null>(null);

  // Step 2 -- Audience
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>(initialData?.audience_filter ?? {});
  const [audienceCount, setAudienceCount] = useState(0);
  const [countLoading, setCountLoading] = useState(false);

  // Step 3 -- Messages (one-time / newsletter)
  const [campaignSteps, setCampaignSteps] = useState<EmailStepDraft[]>(
    initialData?.steps.length ? initialData.steps : [{ subject: "", body_html: "", delay_hours: 0 }]
  );

  // Step 3 -- Flow builder (drip only)
  const [flowData, setFlowData] = useState<FlowData | null>(initialData?.flow_data ?? null);

  // Step 4 -- Review / saving
  const [saving, setSaving] = useState(false);
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(initialData?.id ?? null);

  // Reset steps when campaign type changes
  const handleTypeChange = (newType: CampaignType) => {
    if (newType !== type) {
      setType(newType);
      setCampaignSteps([{ subject: "", body_html: "", delay_hours: 0 }]);
      setFlowData(null);
    }
  };

  const handleFilterChange = (filter: AudienceFilter) => {
    setAudienceFilter(filter);
    setCountLoading(true);

    // Sync flow trigger node with enrollment type
    if (type === "drip" && flowData && filter.enrollment_type !== audienceFilter.enrollment_type) {
      const triggerEvent = (filter.enrollment_type ?? "new_leads") === "existing" ? "manual" : "lead_created";
      setFlowData({
        ...flowData,
        nodes: flowData.nodes.map((n) =>
          n.type === "trigger"
            ? { ...n, data: { ...n.data, event: triggerEvent } }
            : n
        ),
      });
    }
  };

  // Audience count -- debounced
  useEffect(() => {
    const params = new URLSearchParams();
    if (audienceFilter.source) params.set("source", audienceFilter.source);
    if (audienceFilter.funnel_id) params.set("funnel_id", audienceFilter.funnel_id);
    if (audienceFilter.stage_id) params.set("stage_id", audienceFilter.stage_id);
    if (audienceFilter.assigned_to) params.set("assigned_to", audienceFilter.assigned_to);
    if (audienceFilter.tags?.length) params.set("tags", audienceFilter.tags.join(","));
    if (audienceFilter.include_archived) params.set("include_archived", "true");

    const timeout = setTimeout(() => {
      safeFetch<{ count: number }>(
        `/api/campaigns/email/audience-count?${params.toString()}`
      ).then((result) => {
        setCountLoading(false);
        if (result.ok) {
          setAudienceCount(result.data.count);
        }
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [audienceFilter]);

  // canProceed
  const canProceed = (() => {
    switch (step) {
      case 0:
        return name.trim().length > 0;
      case 1: {
        // For drip "new_leads" enrollment, no existing contacts needed
        if (type === "drip" && (audienceFilter.enrollment_type ?? "new_leads") === "new_leads") {
          return true;
        }
        return (audienceCount + (audienceFilter.extra_emails?.length ?? 0)) > 0;
      }
      case 2:
        if (type === "drip") {
          return flowData !== null && validateEmailFlow(flowData);
        }
        return campaignSteps.every((s) => s.subject.trim().length > 0 && s.body_html.trim().length > 0);
      case 3:
        return true;
      default:
        return false;
    }
  })();

  const buildPayload = useCallback(
    (activate: boolean) => {
      const isDrip = type === "drip";

      let triggerEvent: string | undefined;
      if (isDrip) {
        const enrollment = audienceFilter.enrollment_type ?? "new_leads";
        triggerEvent = enrollment === "existing" ? "manual" : "lead_created";
      }

      if (isDrip && flowData) {
        const { steps: branchingSteps, edges: branchingEdges } = flowToEmailStepsWithBranching(flowData);
        return {
          name: name.trim() || "Untitled Campaign",
          type,
          trigger_event: triggerEvent,
          audience_filter: audienceFilter,
          stop_condition: stopCondition,
          flow_data: flowData,
          steps: branchingSteps.map((s, i) => ({
            node_id: s.node_id,
            order: i + 1,
            step_type: s.step_type,
            subject: s.subject,
            preview_text: s.preview_text,
            body_html: s.body_html,
            delay_hours: s.delay_hours,
            ...(s.condition ? { condition: s.condition } : {}),
          })),
          branching_edges: branchingEdges,
          activate,
        };
      }

      // Non-drip or drip without flow data yet
      const stepsToSave = isDrip ? [] : campaignSteps;
      return {
        name: name.trim() || "Untitled Campaign",
        type,
        audience_filter: audienceFilter,
        stop_condition: stopCondition,
        flow_data: flowData ?? undefined,
        steps: stepsToSave.map((s, i) => ({
          ...(s.id ? { id: s.id } : {}),
          order: i + 1,
          subject: s.subject,
          preview_text: s.preview_text,
          body_html: s.body_html,
          delay_hours: i === 0 ? 0 : s.delay_hours,
          ...(s.condition ? { condition: s.condition } : {}),
        })),
        activate,
      };
    },
    [name, type, audienceFilter, campaignSteps, flowData],
  );

  const handleSave = useCallback(
    async (activate: boolean) => {
      setSaving(true);
      const payload = buildPayload(activate);

      let result;
      if (savedCampaignId) {
        result = await safeFetch(`/api/campaigns/email?id=${savedCampaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payload.name,
            audience_filter: payload.audience_filter,
            flow_data: payload.flow_data,
            steps: payload.steps,
            ...(activate ? { status: "active" } : {}),
          }),
        });
      } else {
        result = await safeFetch("/api/campaigns/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (result.ok && result.data) {
          setSavedCampaignId((result.data as { id: string }).id);
        }
      }

      setSaving(false);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        activate
          ? isEditing ? "Campaign updated and activated" : "Campaign created and activated"
          : isEditing ? "Campaign updated" : "Campaign saved as draft"
      );
      router.push(isEditing ? `/email/campaigns/${savedCampaignId}` : "/email");
    },
    [buildPayload, router, savedCampaignId],
  );

  const handleQuickDraft = useCallback(async () => {
    setSaving(true);
    const payload = buildPayload(false);

    let result;
    if (savedCampaignId) {
      // Update existing draft
      result = await safeFetch(`/api/campaigns/email?id=${savedCampaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          audience_filter: payload.audience_filter,
          flow_data: payload.flow_data,
        }),
      });
    } else {
      // Create new draft
      result = await safeFetch("/api/campaigns/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (result.ok && result.data) {
        setSavedCampaignId((result.data as { id: string }).id);
      }
    }

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Campaign saved as draft");
  }, [buildPayload, savedCampaignId]);

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={i >= step}
                onClick={() => i < step && setStep(i)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  i < step
                    ? "border-primary bg-primary text-primary-foreground cursor-pointer hover:opacity-80"
                    : i === step
                      ? "border-primary text-primary"
                      : "border-muted-foreground/30 text-muted-foreground/50"
                )}
              >
                {i < step ? "\u2713" : i + 1}
              </button>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  i <= step
                    ? "text-foreground"
                    : "text-muted-foreground/50"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 mb-5 h-0.5 w-8 sm:w-12",
                  i < step ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className={cn(
        "mx-auto",
        step === 2 && type === "drip" ? "max-w-5xl" : "max-w-2xl",
      )}>
        {step === 0 && (
          <CampaignStepDetails
            name={name}
            onNameChange={setName}
            type={type}
            onTypeChange={handleTypeChange}
            stages={stages}
            stopCondition={stopCondition}
            onStopConditionChange={setStopCondition}
          />
        )}

        {step === 1 && (
          <CampaignStepAudience
            filter={audienceFilter}
            onFilterChange={handleFilterChange}
            sources={sources}
            funnels={funnels}
            stages={stages}
            teamMembers={teamMembers}
            audienceCount={audienceCount}
            countLoading={countLoading}
            channel="email"
            campaignType={type}
          />
        )}

        {step === 2 && type === "drip" && (
          <EmailDripFlowCanvas
            flowData={flowData}
            onFlowChange={setFlowData}
          />
        )}

        {step === 2 && type !== "drip" && (
          <EmailCampaignStepMessages
            steps={campaignSteps}
            onStepsChange={setCampaignSteps}
            campaignType={type}
          />
        )}

        {step === 3 && (
          <EmailCampaignStepReview
            name={name}
            type={type}
            filter={audienceFilter}
            steps={type === "drip" && flowData ? flowToEmailSteps(flowData) : campaignSteps}
            audienceCount={audienceCount}
            saving={saving}
            onSave={handleSave}
            onBack={() => setStep(2)}
            funnels={funnels}
            stages={stages}
            teamMembers={teamMembers}
            sources={sources}
          />
        )}
      </div>

      {/* Navigation */}
      {step < 3 && (
        <div className={cn(
          "mx-auto flex justify-between",
          step === 2 && type === "drip" ? "max-w-5xl" : "max-w-2xl",
        )}>
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={handleQuickDraft}
              className="text-muted-foreground"
            >
              {saving ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-3.5" />
              )}
              Save Draft
            </Button>
            <Button disabled={!canProceed} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

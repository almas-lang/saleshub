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
  CampaignStepDraft,
  CampaignType,
  FlowData,
} from "@/types/campaigns";
import { CampaignStepDetails } from "./campaign-step-details";
import { CampaignStepAudience } from "./campaign-step-audience";
import { CampaignStepMessages } from "./campaign-step-messages";
import { CampaignStepReview } from "./campaign-step-review";
import { DripFlowCanvas, validateFlow, flowToSteps, flowToWaStepsWithBranching } from "./drip-flow-canvas";

// Shape returned by Meta API via /api/whatsapp/templates
interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  components: { type: string; text?: string }[];
}

// Normalized shape used by wizard steps
export interface WizardTemplate {
  id: string;
  name: string;
  body_text: string | null;
}

function normalizeTemplates(meta: MetaTemplate[]): WizardTemplate[] {
  return meta
    .filter((t) => t.status === "APPROVED")
    .map((t) => ({
      id: t.id,
      name: t.name,
      body_text:
        t.components.find((c) => c.type === "BODY")?.text ?? null,
    }));
}

interface FilterOption {
  id: string;
  name: string;
}

interface StageOption extends FilterOption {
  funnel_id: string;
  order: number;
}

interface CampaignWizardProps {
  funnels: FilterOption[];
  stages: StageOption[];
  teamMembers: FilterOption[];
  sources: string[];
}

const STEPS = [
  { label: "Details" },
  { label: "Audience" },
  { label: "Messages" },
  { label: "Review" },
];

export function CampaignWizard({
  funnels,
  stages,
  teamMembers,
  sources,
}: CampaignWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Templates — fetched client-side from Meta API
  const [templates, setTemplates] = useState<WizardTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    safeFetch<{ templates: MetaTemplate[] }>("/api/whatsapp/templates").then(
      (result) => {
        setTemplatesLoading(false);
        if (result.ok) {
          setTemplates(normalizeTemplates(result.data.templates));
        }
      }
    );
  }, []);

  // Step 1 — Details
  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("one_time");

  // Step 2 — Audience
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>({});
  const [audienceCount, setAudienceCount] = useState(0);
  const [countLoading, setCountLoading] = useState(false);

  // Step 3 — Messages
  const [campaignSteps, setCampaignSteps] = useState<CampaignStepDraft[]>([
    { template_id: "", wa_template_name: "", delay_hours: 0, wa_template_params: [] },
  ]);

  // Step 3 — Flow builder (drip only)
  const [flowData, setFlowData] = useState<FlowData | null>(null);

  // Step 4 — Review / saving
  const [saving, setSaving] = useState(false);

  // Reset steps when campaign type changes
  const handleTypeChange = (newType: CampaignType) => {
    if (newType !== type) {
      setType(newType);
      setCampaignSteps([
        { template_id: "", wa_template_name: "", delay_hours: 0, wa_template_params: [] },
      ]);
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

  // Audience count — debounced
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
        `/api/campaigns/whatsapp/audience-count?${params.toString()}`
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
        return audienceCount > 0;
      }
      case 2:
        if (type === "drip") {
          return flowData !== null && validateFlow(flowData);
        }
        return campaignSteps.every((s) => s.wa_template_name.length > 0);
      case 3:
        return true;
      default:
        return false;
    }
  })();

  const buildPayload = useCallback(
    (activate: boolean) => {
      const isDrip = type === "drip";

      if (isDrip && flowData) {
        const enrollment = audienceFilter.enrollment_type ?? "new_leads";
        const triggerEvent = enrollment === "existing" ? "manual" as const : "lead_created" as const;
        const syncedFlowData: FlowData = {
          ...flowData,
          nodes: flowData.nodes.map((n) =>
            n.type === "trigger"
              ? { ...n, data: { ...n.data, event: triggerEvent } }
              : n
          ),
        };

        const { steps: branchingSteps, edges: branchingEdges } =
          flowToWaStepsWithBranching(syncedFlowData);

        return {
          name: name.trim() || "Untitled Campaign",
          type,
          audience_filter: audienceFilter,
          steps: branchingSteps.map((s, i) => ({
            node_id: s.node_id,
            order: i + 1,
            step_type: s.step_type,
            wa_template_name: s.wa_template_name,
            template_id: s.template_id,
            delay_hours: i === 0 ? 0 : s.delay_hours,
            wa_template_params: s.wa_template_params,
            ...(s.condition ? { condition: s.condition } : {}),
          })),
          branching_edges: branchingEdges,
          activate,
          flow_data: syncedFlowData,
        };
      }

      const stepsToSave = isDrip ? [] : campaignSteps;
      return {
        name: name.trim() || "Untitled Campaign",
        type,
        audience_filter: audienceFilter,
        flow_data: flowData ?? undefined,
        steps: stepsToSave.map((s, i) => ({
          order: i + 1,
          step_type: "send",
          wa_template_name: s.wa_template_name,
          template_id: s.template_id,
          delay_hours: i === 0 ? 0 : s.delay_hours,
          wa_template_params: s.wa_template_params,
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

      const result = await safeFetch("/api/campaigns/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setSaving(false);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        activate ? "Campaign created and activated" : "Campaign saved as draft"
      );
      router.push("/whatsapp");
    },
    [buildPayload, router],
  );

  const handleQuickDraft = useCallback(async () => {
    setSaving(true);
    const payload = buildPayload(false);

    const result = await safeFetch("/api/campaigns/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Campaign saved as draft");
    router.push("/whatsapp");
  }, [buildPayload, router]);

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  i < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === step
                      ? "border-primary text-primary"
                      : "border-muted-foreground/30 text-muted-foreground/50"
                )}
              >
                {i < step ? "\u2713" : i + 1}
              </div>
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
            campaignType={type}
          />
        )}

        {step === 2 && type === "drip" && (
          <DripFlowCanvas
            templates={templates}
            templatesLoading={templatesLoading}
            flowData={flowData}
            onFlowChange={setFlowData}
          />
        )}

        {step === 2 && type !== "drip" && (
          <CampaignStepMessages
            steps={campaignSteps}
            onStepsChange={setCampaignSteps}
            templates={templates}
            templatesLoading={templatesLoading}
            campaignType={type}
          />
        )}

        {step === 3 && (
          <CampaignStepReview
            name={name}
            type={type}
            filter={audienceFilter}
            steps={type === "drip" && flowData ? flowToSteps(flowData) : campaignSteps}
            audienceCount={audienceCount}
            saving={saving}
            onSave={handleSave}
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

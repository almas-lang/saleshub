"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import type { AudienceFilter, CampaignType, FlowData } from "@/types/campaigns";
import { CampaignStepDetails, type StopCondition } from "./campaign-step-details";
import { CampaignStepAudience } from "./campaign-step-audience";
import { UnifiedDripFlowCanvas, validateUnifiedFlow, getUnifiedFlowErrors, flowToUnifiedStepsWithBranching } from "./unified-drip-flow-canvas";

// Shape returned by Meta API
interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  components: { type: string; text?: string }[];
}

export interface WizardTemplate {
  id: string;
  name: string;
  language: string;
  body_text: string | null;
}

function normalizeTemplates(meta: MetaTemplate[]): WizardTemplate[] {
  return meta
    .filter((t) => t.status === "APPROVED")
    .map((t) => ({
      id: t.id,
      name: t.name,
      language: t.language,
      body_text: t.components.find((c) => c.type === "BODY")?.text ?? null,
    }));
}

interface FilterOption { id: string; name: string }
interface StageOption { id: string; name: string; funnel_id: string; order: number }

interface ExistingCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  audience_filter: AudienceFilter | null;
  stop_condition: StopCondition | null;
  flow_data: FlowData | null;
}

interface UnifiedCampaignWizardProps {
  funnels: FilterOption[];
  stages: StageOption[];
  teamMembers: FilterOption[];
  sources: string[];
  existingCampaign?: ExistingCampaign;
}

const STEPS = [
  { label: "Details" },
  { label: "Audience" },
  { label: "Messages" },
  { label: "Review" },
];

export function UnifiedCampaignWizard({
  funnels,
  stages,
  teamMembers,
  sources,
  existingCampaign,
}: UnifiedCampaignWizardProps) {
  const router = useRouter();
  // Resume at the furthest completed step
  const initialStep = existingCampaign
    ? existingCampaign.flow_data ? 2  // Has flow data → Messages step
    : existingCampaign.audience_filter && Object.keys(existingCampaign.audience_filter).length > 0 ? 1  // Has audience → Audience step
    : 0
    : 0;
  const [step, setStep] = useState(initialStep);

  // Templates — fetched client-side from Meta API (for WA nodes)
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
  const [name, setName] = useState(existingCampaign?.name ?? "");
  const type: CampaignType = "drip"; // Unified is always drip

  // Stop condition
  const [stopCondition, setStopCondition] = useState<StopCondition | null>(existingCampaign?.stop_condition ?? null);

  // Step 2 — Audience
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>(existingCampaign?.audience_filter ?? {});
  const [audienceCount, setAudienceCount] = useState(0);
  const [countLoading, setCountLoading] = useState(false);

  // Step 3 — Flow builder
  const [flowData, setFlowData] = useState<FlowData | null>(existingCampaign?.flow_data ?? null);

  // Active/paused campaigns can't edit steps
  const isActive = existingCampaign?.status === "active";
  const isPaused = existingCampaign?.status === "paused";
  const isLocked = isActive || isPaused;

  // Step 4 — Saving
  const [saving, setSaving] = useState(false);
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(existingCampaign?.id ?? null);

  const handleFilterChange = (filter: AudienceFilter) => {
    setAudienceFilter(filter);
    setCountLoading(true);

    // Sync flow trigger node
    if (flowData && filter.enrollment_type !== audienceFilter.enrollment_type) {
      const triggerEvent = (filter.enrollment_type ?? "new_leads") === "existing" ? "manual" : "lead_created";
      setFlowData({
        ...flowData,
        nodes: flowData.nodes.map((n) =>
          n.type === "trigger" ? { ...n, data: { ...n.data, event: triggerEvent } } : n
        ),
      });
    }
  };

  // Audience count
  useEffect(() => {
    const params = new URLSearchParams();
    if (audienceFilter.source) params.set("source", audienceFilter.source);
    if (audienceFilter.funnel_id) params.set("funnel_id", audienceFilter.funnel_id);
    if (audienceFilter.stage_id) params.set("stage_id", audienceFilter.stage_id);
    if (audienceFilter.assigned_to) params.set("assigned_to", audienceFilter.assigned_to);
    if (audienceFilter.tags?.length) params.set("tags", audienceFilter.tags.join(","));
    if (audienceFilter.include_archived) params.set("include_archived", "true");

    const timer = setTimeout(() => {
      safeFetch<{ count: number }>(`/api/campaigns/whatsapp/audience-count?${params}`).then(
        (result) => {
          setCountLoading(false);
          if (result.ok) setAudienceCount(result.data.count);
        }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [audienceFilter]);

  // Validation
  const canProceed = (() => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: {
        if ((audienceFilter.enrollment_type ?? "new_leads") === "new_leads") return true;
        return audienceCount > 0;
      }
      case 2: return flowData !== null && validateUnifiedFlow(flowData);
      case 3: return true;
      default: return false;
    }
  })();

  const buildPayload = useCallback(
    (activate: boolean) => {
      const enrollment = audienceFilter.enrollment_type ?? "new_leads";
      const triggerEvent = enrollment === "existing" ? "manual" : "lead_created";

      if (!flowData) {
        // Early save with no flow data yet — save name/audience/stop condition only
        return {
          name: name.trim() || "Untitled Campaign",
          type: "drip" as const,
          audience_filter: audienceFilter,
          stop_condition: stopCondition,
          steps: [],
          branching_edges: [],
          activate: false,
          flow_data: null,
        };
      }

      const syncedFlowData: FlowData = {
        ...flowData,
        nodes: flowData.nodes.map((n) =>
          n.type === "trigger" ? { ...n, data: { ...n.data, event: triggerEvent } } : n
        ),
      };

      const { steps: branchingSteps, edges: branchingEdges } =
        flowToUnifiedStepsWithBranching(syncedFlowData);

      return {
        name: name.trim() || "Untitled Campaign",
        type: "drip" as const,
        audience_filter: audienceFilter,
        stop_condition: stopCondition,
        steps: branchingSteps.map((s, i) => ({
          node_id: s.node_id,
          order: i + 1,
          step_type: s.step_type,
          channel: s.channel,
          delay_hours: i === 0 ? 0 : s.delay_hours,
          delay_mode: s.delay_mode ?? "after_previous",
          // Email
          subject: s.subject,
          preview_text: s.preview_text,
          body_html: s.body_html,
          // WA
          wa_template_name: s.wa_template_name,
          wa_template_language: s.wa_template_language,
          wa_template_params: s.wa_template_params,
          wa_template_param_names: s.wa_template_param_names,
          // Condition
          ...(s.condition ? { condition: s.condition } : {}),
        })),
        branching_edges: branchingEdges,
        activate,
        flow_data: syncedFlowData,
      };
    },
    [name, audienceFilter, flowData, stopCondition],
  );

  const handleSave = useCallback(
    async (activate: boolean) => {
      setSaving(true);
      const payload = buildPayload(activate);
      if (!payload) { setSaving(false); return; }

      let result;
      if (savedCampaignId) {
        result = await safeFetch(`/api/campaigns/unified?id=${savedCampaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            ...(activate ? { status: "active" } : {}),
          }),
        });
      } else {
        result = await safeFetch("/api/campaigns/unified", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (result.ok && result.data) {
          setSavedCampaignId((result.data as { id: string }).id);
        }
      }

      setSaving(false);
      if (!result.ok) { toast.error(result.error); return; }

      if (activate) {
        toast.success("Campaign created and activated");
        router.push("/campaigns");
      } else {
        toast.success("Draft saved");
      }
    },
    [buildPayload, router, savedCampaignId],
  );

  return (
    <div className="space-y-8">
      {/* Warning banner for active/paused campaigns */}
      {isLocked && (
        <div className="mx-auto max-w-5xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              This campaign is <strong>{existingCampaign?.status}</strong>.
              {isActive
                ? " You can edit the name, audience, and stop condition, but cannot modify the flow steps while active. Pause the campaign first to edit steps."
                : " You can edit freely while paused. Resume when ready."}
            </span>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                i < step ? "border-primary bg-primary text-primary-foreground"
                  : i === step ? "border-primary text-primary"
                  : "border-muted-foreground/30 text-muted-foreground/50"
              )}>
                {i < step ? "\u2713" : i + 1}
              </div>
              <span className={cn("text-[11px] font-medium", i <= step ? "text-foreground" : "text-muted-foreground/50")}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-2 mb-5 h-0.5 w-8 sm:w-12", i < step ? "bg-primary" : "bg-muted-foreground/20")} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className={cn("mx-auto", step === 2 ? "max-w-5xl" : "max-w-2xl")}>
        {step === 0 && (
          <CampaignStepDetails
            name={name}
            onNameChange={setName}
            type={type}
            onTypeChange={() => {}} // Fixed to drip
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
            campaignType={type}
          />
        )}

        {step === 2 && (
          <>
            {isActive && (
              <div className="mb-3 rounded-md border border-dashed border-amber-300 bg-amber-50/50 p-3 text-center text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                Flow is read-only while the campaign is active. Pause to edit.
              </div>
            )}
            <UnifiedDripFlowCanvas
              templates={templates}
              templatesLoading={templatesLoading}
              flowData={flowData}
              onFlowChange={isActive ? () => {} : setFlowData}
              onBack={() => setStep((s) => s - 1)}
              onContinue={() => setStep((s) => s + 1)}
              canContinue={canProceed}
              onSaveDraft={() => handleSave(false)}
              saving={saving}
            />
            {flowData && !validateUnifiedFlow(flowData) && (
              <div className="mt-2 space-y-1">
                {getUnifiedFlowErrors(flowData).map((err, i) => (
                  <p key={i} className="text-sm text-destructive">{err}</p>
                ))}
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="rounded-lg border p-6 space-y-4">
              <h3 className="text-lg font-semibold">Review Campaign</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{name || "Untitled"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">Unified Drip (Email + WhatsApp)</p>
                </div>
                {stopCondition && (
                  <div>
                    <p className="text-muted-foreground">Auto-stop</p>
                    <p className="font-medium">When contact reaches: {stopCondition.stage_name ?? stopCondition.stage_id}</p>
                  </div>
                )}
                {flowData && (
                  <div>
                    <p className="text-muted-foreground">Steps</p>
                    <p className="font-medium">
                      {flowData.nodes.filter((n) => n.type === "unified_send").length} send node(s)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                <Save className="mr-2 size-4" />
                Save as Draft
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save &amp; Activate
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {step < 3 && (
        <div className={cn("mx-auto flex justify-between", step === 2 ? "max-w-5xl" : "max-w-2xl")}>
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            {name.trim() && (
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                <Save className="mr-2 size-4" />
                Save Draft
              </Button>
            )}
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

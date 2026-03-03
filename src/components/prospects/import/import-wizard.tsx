"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { autoMapColumns, autoMapFormResponseColumns } from "@/lib/import-utils";
import type { ValidationResult, FormResponseValidationResult } from "@/lib/import-utils";
import type {
  ParsedFile,
  ImportMapping,
  ImportConfig,
  ImportType,
  FormResponseConfig,
  AnyFieldKey,
} from "@/types/import";
import { StepUpload } from "./step-upload";
import { StepMapping } from "./step-mapping";
import { StepConfigure } from "./step-configure";
import { StepReview } from "./step-review";
import { StepProgress } from "./step-progress";

interface ImportWizardProps {
  funnels: { id: string; name: string }[];
  stages: { id: string; name: string; funnel_id: string; order: number }[];
  teamMembers: { id: string; name: string }[];
}

const STEPS = [
  { label: "Upload" },
  { label: "Map" },
  { label: "Configure" },
  { label: "Review" },
  { label: "Import" },
];

export function ImportWizard({ funnels, stages, teamMembers }: ImportWizardProps) {
  const [importType, setImportType] = useState<ImportType>("contacts");
  const [step, setStep] = useState(0);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [mappings, setMappings] = useState<ImportMapping[]>([]);
  const [config, setConfig] = useState<ImportConfig>({
    duplicate_handling: "skip",
    normalize_phones: true,
    trim_whitespace: true,
    default_funnel_id: "",
    default_stage_id: "",
    default_assigned_to: "",
    default_source: "",
    default_tags: [],
  });
  const [formResponseConfig, setFormResponseConfig] = useState<FormResponseConfig>({
    target_funnel_id: "",
    target_stage_id: "",
    duplicate_handling: "skip",
    trim_whitespace: true,
  });
  const [validRows, setValidRows] = useState<ValidationResult["valid"]>([]);
  const [validFormResponseRows, setValidFormResponseRows] = useState<FormResponseValidationResult["valid"]>([]);

  const handleFileParsed = useCallback((file: ParsedFile) => {
    setParsedFile(file);
    setMappings(
      importType === "form_responses"
        ? autoMapFormResponseColumns(file.headers)
        : autoMapColumns(file.headers)
    );
    setStep(1);
  }, [importType]);

  const handleFileRemove = useCallback(() => {
    setParsedFile(null);
    setMappings([]);
    setStep(0);
  }, []);

  const handleMappingChange = useCallback(
    (index: number, field: AnyFieldKey | "__skip__") => {
      setMappings((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], contactField: field, autoDetected: false };
        return next;
      });
    },
    []
  );

  const handleStartImport = useCallback(
    (rows: ValidationResult["valid"]) => {
      setValidRows(rows);
      setStep(4);
    },
    []
  );

  const handleStartFormResponseImport = useCallback(
    (rows: FormResponseValidationResult["valid"]) => {
      setValidFormResponseRows(rows);
      setStep(4);
    },
    []
  );

  const handleImportAnother = useCallback(() => {
    setParsedFile(null);
    setMappings([]);
    setValidRows([]);
    setValidFormResponseRows([]);
    setConfig({
      duplicate_handling: "skip",
      normalize_phones: true,
      trim_whitespace: true,
      default_funnel_id: "",
      default_stage_id: "",
      default_assigned_to: "",
      default_source: "",
      default_tags: [],
    });
    setFormResponseConfig({
      target_funnel_id: "",
      target_stage_id: "",
      duplicate_handling: "skip",
      trim_whitespace: true,
    });
    setImportType("contacts");
    setStep(0);
  }, []);

  const handleImportTypeChange = useCallback((type: ImportType) => {
    setImportType(type);
    // Reset file and mappings when switching type
    setParsedFile(null);
    setMappings([]);
    setValidRows([]);
    setValidFormResponseRows([]);
  }, []);

  const canProceed = (() => {
    switch (step) {
      case 0:
        return !!parsedFile;
      case 1:
        if (importType === "form_responses") {
          return mappings.some((m) => m.contactField === "email");
        }
        return mappings.some((m) => m.contactField === "first_name");
      case 2:
        if (importType === "form_responses") {
          return !!formResponseConfig.target_funnel_id && !!formResponseConfig.target_stage_id;
        }
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  })();

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
      <div className="mx-auto max-w-2xl">
        {step === 0 && (
          <>
            {/* Import type selector */}
            <div className="mb-6 space-y-3">
              <p className="text-sm font-medium">What are you importing?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleImportTypeChange("contacts")}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    importType === "contacts"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <p className="text-sm font-medium">Import Contacts</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    New leads with name, phone, email, source
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleImportTypeChange("form_responses")}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    importType === "form_responses"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <p className="text-sm font-medium">Import Form Responses</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Calendly qualifying data for existing contacts
                  </p>
                </button>
              </div>
            </div>

            <StepUpload
              parsedFile={parsedFile}
              onFileParsed={handleFileParsed}
              onRemove={handleFileRemove}
            />
          </>
        )}

        {step === 1 && parsedFile && (
          <StepMapping
            headers={parsedFile.headers}
            rows={parsedFile.rows}
            mappings={mappings}
            onMappingChange={handleMappingChange}
            importType={importType}
          />
        )}

        {step === 2 && (
          <StepConfigure
            config={config}
            onConfigChange={setConfig}
            funnels={funnels}
            stages={stages}
            teamMembers={teamMembers}
            importType={importType}
            formResponseConfig={formResponseConfig}
            onFormResponseConfigChange={setFormResponseConfig}
          />
        )}

        {step === 3 && parsedFile && (
          <StepReview
            parsedFile={parsedFile}
            mappings={mappings}
            config={config}
            onStartImport={handleStartImport}
            importType={importType}
            formResponseConfig={formResponseConfig}
            onStartFormResponseImport={handleStartFormResponseImport}
          />
        )}

        {step === 4 && (
          <StepProgress
            validRows={validRows}
            config={config}
            onImportAnother={handleImportAnother}
            importType={importType}
            validFormResponseRows={validFormResponseRows}
            formResponseConfig={formResponseConfig}
          />
        )}
      </div>

      {/* Navigation */}
      {step > 0 && step < 4 && (
        <div className="mx-auto flex max-w-2xl justify-between">
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            Back
          </Button>
          {step < 3 && (
            <Button disabled={!canProceed} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  applyMappings,
  applyFormResponseMappings,
  validateMappedRows,
  validateFormResponseRows,
  type ValidationResult,
  type FormResponseValidationResult,
} from "@/lib/import-utils";
import { MAPPABLE_FIELDS, FORM_RESPONSE_FIELDS } from "@/types/import";
import type {
  ImportMapping,
  ImportConfig,
  ImportType,
  FormResponseConfig,
  ParsedFile,
} from "@/types/import";

interface StepReviewProps {
  parsedFile: ParsedFile;
  mappings: ImportMapping[];
  config: ImportConfig;
  onStartImport: (validRows: ValidationResult["valid"]) => void;
  importType: ImportType;
  formResponseConfig: FormResponseConfig;
  onStartFormResponseImport: (validRows: FormResponseValidationResult["valid"]) => void;
}

export function StepReview({
  parsedFile,
  mappings,
  config,
  onStartImport,
  importType,
  formResponseConfig,
  onStartFormResponseImport,
}: StepReviewProps) {
  const isFormResponses = importType === "form_responses";

  const { validationResult, formResponseValidationResult, activeMappings } = useMemo(() => {
    const active = mappings.filter((m) => m.contactField !== "__skip__");

    if (isFormResponses) {
      const mapped = applyFormResponseMappings(parsedFile.rows, mappings, formResponseConfig);
      const frResult = validateFormResponseRows(mapped);
      return { validationResult: null, formResponseValidationResult: frResult, activeMappings: active };
    } else {
      const mapped = applyMappings(parsedFile.rows, mappings, config);
      const result = validateMappedRows(mapped);
      return { validationResult: result, formResponseValidationResult: null, activeMappings: active };
    }
  }, [parsedFile.rows, mappings, config, formResponseConfig, isFormResponses]);

  const allFields = isFormResponses ? FORM_RESPONSE_FIELDS : MAPPABLE_FIELDS;
  const fieldLabel = (key: string) =>
    allFields.find((f) => f.key === key)?.label ?? key;

  const validCount = isFormResponses
    ? formResponseValidationResult!.valid.length
    : validationResult!.valid.length;
  const invalidItems = isFormResponses
    ? formResponseValidationResult!.invalid
    : validationResult!.invalid;

  // Warn if important form response fields are not mapped
  const missingFormFields = isFormResponses
    ? ["financial_readiness", "urgency", "desired_salary", "blocker"].filter(
        (key) => !activeMappings.some((m) => m.contactField === key)
      )
    : [];

  const duplicateLabel = isFormResponses
    ? formResponseConfig.duplicate_handling === "skip"
      ? "Skip if form response exists"
      : "Create new response"
    : config.duplicate_handling === "skip"
      ? "Skip duplicates"
      : config.duplicate_handling === "update"
        ? "Update existing"
        : "Always create new";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">
          Review {isFormResponses ? "form response" : ""} import
        </h3>
        <p className="text-sm text-muted-foreground">
          Verify your settings before starting the import.
        </p>
      </div>

      {/* File info */}
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">File</p>
        <p className="text-sm text-muted-foreground">
          {parsedFile.name} &middot; {parsedFile.totalRows.toLocaleString()}{" "}
          rows
        </p>
      </div>

      {/* Mapping summary */}
      <div className="rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">Column mapping</p>
        <div className="flex flex-wrap gap-2">
          {activeMappings.map((m) => (
            <Badge key={m.csvColumn} variant="secondary" className="text-xs">
              {m.csvColumn} → {fieldLabel(m.contactField)}
            </Badge>
          ))}
        </div>
        {mappings.filter((m) => m.contactField === "__skip__").length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {mappings.filter((m) => m.contactField === "__skip__").length}{" "}
            column(s) skipped
          </p>
        )}
        {missingFormFields.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              Missing columns for: {missingFormFields.map(f => f.replace(/_/g, " ")).join(", ")}
            </p>
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
              Your CSV does not have columns mapped to these fields. They will be empty after import.
              Check if your Google Sheet has columns for these Calendly form questions.
            </p>
          </div>
        )}
      </div>

      {/* Config summary */}
      <div className="rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">Configuration</p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Duplicates: {duplicateLabel}</p>
          {!isFormResponses && config.default_source && <p>Default source: {config.default_source}</p>}
          {!isFormResponses && config.default_tags.length > 0 && (
            <p>Default tags: {config.default_tags.join(", ")}</p>
          )}
          {!isFormResponses && config.normalize_phones && <p>Phone normalization: enabled</p>}
          {isFormResponses && <p>Auto-move to target stage: enabled</p>}
          {(isFormResponses ? formResponseConfig.trim_whitespace : config.trim_whitespace) && (
            <p>Trim whitespace: enabled</p>
          )}
        </div>
      </div>

      {/* Validation results */}
      <div className="rounded-lg border p-4">
        <p className="mb-3 text-sm font-medium">Validation</p>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span className="text-sm">
              {validCount.toLocaleString()} valid rows
            </span>
          </div>
          {invalidItems.length > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-destructive" />
              <span className="text-sm">
                {invalidItems.length.toLocaleString()} rows with issues
              </span>
            </div>
          )}
        </div>
        {invalidItems.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto rounded border bg-muted/30 p-3">
            {invalidItems.slice(0, 10).map((item) => (
              <p key={item.index} className="text-xs text-destructive">
                Row {item.index + 1}: {item.errors.join("; ")}
              </p>
            ))}
            {invalidItems.length > 10 && (
              <p className="mt-1 text-xs text-muted-foreground">
                ...and {invalidItems.length - 10} more
              </p>
            )}
          </div>
        )}
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={validCount === 0}
        onClick={() => {
          if (isFormResponses) {
            onStartFormResponseImport(formResponseValidationResult!.valid);
          } else {
            onStartImport(validationResult!.valid);
          }
        }}
      >
        Start Import ({validCount.toLocaleString()} rows)
      </Button>
    </div>
  );
}

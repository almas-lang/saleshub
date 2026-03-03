"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ImportPreviewTable } from "./import-preview-table";
import { ColumnMapper } from "./column-mapper";
import type { ImportMapping, ImportType, AnyFieldKey } from "@/types/import";

interface StepMappingProps {
  headers: string[];
  rows: Record<string, string>[];
  mappings: ImportMapping[];
  onMappingChange: (index: number, field: AnyFieldKey | "__skip__") => void;
  importType: ImportType;
}

export function StepMapping({
  headers,
  rows,
  mappings,
  onMappingChange,
  importType,
}: StepMappingProps) {
  const isFormResponses = importType === "form_responses";
  const hasRequiredField = isFormResponses
    ? mappings.some((m) => m.contactField === "email")
    : mappings.some((m) => m.contactField === "first_name");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Map columns</h3>
        <p className="text-sm text-muted-foreground">
          {isFormResponses
            ? "Match your file columns to qualifying form response fields."
            : "Match your file columns to the corresponding contact fields."}
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Data preview
        </p>
        <ImportPreviewTable headers={headers} rows={rows} />
      </div>

      {!hasRequiredField && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {isFormResponses
              ? <>You must map at least one column to <strong>Email</strong> to match existing contacts.</>
              : <>You must map at least one column to <strong>First Name</strong> to continue.</>}
          </AlertDescription>
        </Alert>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Column mapping
        </p>
        <ColumnMapper
          mappings={mappings}
          onMappingChange={onMappingChange}
          importType={importType}
        />
      </div>
    </div>
  );
}

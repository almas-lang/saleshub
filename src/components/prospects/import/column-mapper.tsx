"use client";

import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAPPABLE_FIELDS,
  FORM_RESPONSE_FIELDS,
  type AnyFieldKey,
  type ImportType,
} from "@/types/import";
import type { ImportMapping } from "@/types/import";

interface ColumnMapperProps {
  mappings: ImportMapping[];
  onMappingChange: (index: number, field: AnyFieldKey | "__skip__") => void;
  importType?: ImportType;
}

export function ColumnMapper({ mappings, onMappingChange, importType = "contacts" }: ColumnMapperProps) {
  const fields = importType === "form_responses" ? FORM_RESPONSE_FIELDS : MAPPABLE_FIELDS;

  // Track which fields are already mapped to prevent duplicates
  const usedFields = new Set(
    mappings
      .filter((m) => m.contactField !== "__skip__")
      .map((m) => m.contactField)
  );

  return (
    <div className="space-y-2">
      {mappings.map((mapping, index) => {
        const isSkipped = mapping.contactField === "__skip__";

        return (
          <div
            key={mapping.csvColumn}
            className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
          >
            <Badge variant="secondary" className="shrink-0 font-mono text-xs">
              {mapping.csvColumn}
            </Badge>

            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />

            <Select
              value={mapping.contactField}
              onValueChange={(value) =>
                onMappingChange(index, value as AnyFieldKey | "__skip__")
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__skip__">Skip this column</SelectItem>
                {fields.map((field) => {
                  // Allow multiple columns to map to "metadata" (contacts only)
                  const isUsed =
                    field.key !== "metadata" &&
                    usedFields.has(field.key) &&
                    mapping.contactField !== field.key;
                  return (
                    <SelectItem
                      key={field.key}
                      value={field.key}
                      disabled={isUsed}
                    >
                      {field.label}
                      {"required" in field && field.required ? " *" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {mapping.autoDetected && !isSkipped && (
              <span className="text-xs text-muted-foreground">
                Auto-detected
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

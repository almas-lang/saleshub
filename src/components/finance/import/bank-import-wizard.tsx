"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, ArrowRight, Upload, Columns3, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/prospects/import/file-dropzone";
import { parseCSVFile, parseXLSXFile } from "@/lib/import-utils";
import { autoMapBankColumns, parseRawBankRow, validateBankMappings } from "@/lib/bank-import-utils";
import type { ParsedFile } from "@/types/import";
import type { BankColumnMapping, ParsedBankRow } from "@/lib/bank-import-utils";
import { StepMapColumns } from "./step-map-columns";
import { StepReview } from "./step-review";
import { StepProgress } from "./step-progress";

type Step = "upload" | "map" | "review" | "import";

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "map", label: "Map Columns", icon: Columns3 },
  { key: "review", label: "Review", icon: CheckCircle2 },
  { key: "import", label: "Import", icon: Loader2 },
];

export function BankImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<BankColumnMapping[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedBankRow[]>([]);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const handleParseFile = useCallback(async (file: File): Promise<ParsedFile> => {
    setFileError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      const msg = "Unsupported file type. Please upload a CSV or XLSX file.";
      setFileError(msg);
      throw new Error(msg);
    }
    try {
      const result = ext === "csv" ? await parseCSVFile(file) : await parseXLSXFile(file);
      if (result.totalRows === 0) {
        const msg = "File is empty — no rows found.";
        setFileError(msg);
        throw new Error(msg);
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file";
      setFileError(msg);
      throw err;
    }
  }, []);

  const handleFileParsed = useCallback((file: ParsedFile) => {
    setParsedFile(file);
    setFileError(null);
    // Auto-map columns
    const autoMapped = autoMapBankColumns(file.headers);
    setMappings(autoMapped);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setParsedFile(null);
    setMappings([]);
    setParsedRows([]);
    setFileError(null);
    setMappingError(null);
    setStep("upload");
  }, []);

  const handleNextFromUpload = () => {
    if (!parsedFile) return;
    setStep("map");
  };

  const handleNextFromMap = () => {
    if (!parsedFile) return;
    const error = validateBankMappings(mappings);
    if (error) {
      setMappingError(error);
      return;
    }
    setMappingError(null);

    // Parse all rows with the mappings
    const rows = parsedFile.rows.map((row) => parseRawBankRow(row, mappings));
    setParsedRows(rows);
    setStep("review");
  };

  const handleNextFromReview = () => {
    setStep("import");
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.key === step;
          const isDone = i < currentStepIndex;
          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`h-px w-8 ${isDone ? "bg-primary" : "bg-border"}`} />
              )}
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === "upload" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-medium">Upload Bank Statement</h2>
            <p className="text-sm text-muted-foreground">
              Upload a CSV or XLSX file exported from your bank. Supports HDFC, ICICI, SBI, Axis, and most Indian bank formats.
            </p>
          </div>
          <FileDropzone
            parsedFile={parsedFile}
            onFileParsed={handleFileParsed}
            onRemove={handleRemoveFile}
            onParseFile={handleParseFile}
            error={fileError}
          />
          {parsedFile && (
            <div className="flex justify-end">
              <Button onClick={handleNextFromUpload}>
                Next: Map Columns
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {step === "map" && parsedFile && (
        <div className="space-y-4">
          <StepMapColumns
            headers={parsedFile.headers}
            sampleRows={parsedFile.rows.slice(0, 3)}
            mappings={mappings}
            onMappingsChange={setMappings}
            error={mappingError}
          />
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>
              <ArrowLeft className="mr-1.5 size-4" />
              Back
            </Button>
            <Button onClick={handleNextFromMap}>
              Next: Review
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <StepReview
            rows={parsedRows}
            onRowsChange={setParsedRows}
          />
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep("map")}>
              <ArrowLeft className="mr-1.5 size-4" />
              Back
            </Button>
            <Button
              onClick={handleNextFromReview}
              disabled={parsedRows.filter((r) => r.selected).length === 0}
            >
              Import {parsedRows.filter((r) => r.selected).length} Transactions
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "import" && (
        <StepProgress
          rows={parsedRows.filter((r) => r.selected)}
          onDone={() => {
            // Stay on this step, the progress component shows the result
          }}
          onReset={handleRemoveFile}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Download, ArrowRight, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { safeFetch } from "@/lib/fetch";
import { chunkArray } from "@/lib/import-utils";
import type { ImportRowValues, ImportFormResponseRowValues } from "@/lib/validations";
import type {
  ImportResults,
  ImportBatchResult,
  ImportConfig,
  ImportType,
  FormResponseConfig,
  FormResponseBatchResult,
  FormResponseImportResults,
} from "@/types/import";

interface StepProgressProps {
  validRows: { index: number; data: ImportRowValues }[];
  config: ImportConfig;
  onImportAnother: () => void;
  importType: ImportType;
  validFormResponseRows: { index: number; data: ImportFormResponseRowValues }[];
  formResponseConfig: FormResponseConfig;
}

const BATCH_SIZE = 50;

export function StepProgress({
  validRows,
  config,
  onImportAnother,
  importType,
  validFormResponseRows,
  formResponseConfig,
}: StepProgressProps) {
  const isFormResponses = importType === "form_responses";

  const [results, setResults] = useState<ImportResults>({
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    totalBatches: 0,
    completedBatches: 0,
  });
  const [frResults, setFrResults] = useState<FormResponseImportResults>({
    matched: 0,
    created: 0,
    skipped: 0,
    errors: [],
    totalBatches: 0,
    completedBatches: 0,
  });
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (isFormResponses) {
      runFormResponseImport();
    } else {
      runContactImport();
    }

    async function runContactImport() {
      const batches = chunkArray(validRows, BATCH_SIZE);

      setResults((prev) => ({ ...prev, totalBatches: batches.length }));

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchRows = batch.map((r) => r.data);

        const response = await safeFetch<ImportBatchResult>(
          "/api/contacts/import",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rows: batchRows,
              config: {
                duplicate_handling: config.duplicate_handling,
                normalize_phones: config.normalize_phones,
                trim_whitespace: config.trim_whitespace,
              },
            }),
          }
        );

        if (response.ok) {
          const batchResult = response.data;
          const offsetErrors = batchResult.errors.map((err) => ({
            row: batch[err.row].index + 1,
            error: err.error,
          }));

          setResults((prev) => ({
            ...prev,
            created: prev.created + batchResult.created,
            updated: prev.updated + batchResult.updated,
            skipped: prev.skipped + batchResult.skipped,
            errors: [...prev.errors, ...offsetErrors],
            completedBatches: i + 1,
          }));
        } else {
          const batchErrors = batch.map((r) => ({
            row: r.index + 1,
            error: response.error,
          }));
          setResults((prev) => ({
            ...prev,
            errors: [...prev.errors, ...batchErrors],
            completedBatches: i + 1,
          }));
        }
      }

      setDone(true);
    }

    async function runFormResponseImport() {
      const batches = chunkArray(validFormResponseRows, BATCH_SIZE);

      setFrResults((prev) => ({ ...prev, totalBatches: batches.length }));

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchRows = batch.map((r) => r.data);

        const response = await safeFetch<FormResponseBatchResult>(
          "/api/contacts/import-form-responses",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rows: batchRows,
              config: {
                target_funnel_id: formResponseConfig.target_funnel_id,
                target_stage_id: formResponseConfig.target_stage_id,
                duplicate_handling: formResponseConfig.duplicate_handling,
                trim_whitespace: formResponseConfig.trim_whitespace,
              },
            }),
          }
        );

        if (response.ok) {
          const batchResult = response.data;
          const offsetErrors = batchResult.errors.map((err) => ({
            row: batch[err.row].index + 1,
            error: err.error,
          }));

          setFrResults((prev) => ({
            ...prev,
            matched: prev.matched + batchResult.matched,
            created: prev.created + batchResult.created,
            skipped: prev.skipped + batchResult.skipped,
            errors: [...prev.errors, ...offsetErrors],
            completedBatches: i + 1,
          }));
        } else {
          const batchErrors = batch.map((r) => ({
            row: r.index + 1,
            error: response.error,
          }));
          setFrResults((prev) => ({
            ...prev,
            errors: [...prev.errors, ...batchErrors],
            completedBatches: i + 1,
          }));
        }
      }

      setDone(true);
    }
  }, [validRows, config, isFormResponses, validFormResponseRows, formResponseConfig]);

  const activeResults = isFormResponses ? frResults : results;
  const progress =
    activeResults.totalBatches > 0
      ? Math.round((activeResults.completedBatches / activeResults.totalBatches) * 100)
      : 0;

  const errorList = activeResults.errors;
  const successCount = isFormResponses
    ? frResults.created
    : results.created + results.updated;

  function downloadErrorReport() {
    if (errorList.length === 0) return;
    const csv = [
      "Row,Error",
      ...errorList.map(
        (e) => `${e.row},"${e.error.replace(/"/g, '""')}"`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">
          {done ? "Import complete" : "Importing..."}
        </h3>
        <p className="text-sm text-muted-foreground">
          {done
            ? "Your import has finished processing."
            : `Processing batch ${activeResults.completedBatches} of ${activeResults.totalBatches}...`}
        </p>
      </div>

      <div className="space-y-2">
        <Progress value={progress} />
        <p className="text-right text-sm text-muted-foreground">{progress}%</p>
      </div>

      {/* Running counters */}
      {isFormResponses ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-semibold text-blue-500">
              {frResults.matched}
            </p>
            <p className="text-xs text-muted-foreground">Matched</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-semibold text-emerald-500">
              {frResults.created}
            </p>
            <p className="text-xs text-muted-foreground">Created</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-semibold text-muted-foreground">
              {frResults.skipped}
            </p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-semibold text-destructive">
              {frResults.errors.length}
            </p>
            <p className="text-xs text-muted-foreground">Errors</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-semibold text-emerald-500">
              {results.created}
            </p>
            <p className="text-xs text-muted-foreground">Created</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-semibold text-blue-500">
              {results.updated}
            </p>
            <p className="text-xs text-muted-foreground">Updated</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-semibold text-muted-foreground">
              {results.skipped}
            </p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-semibold text-destructive">
              {results.errors.length}
            </p>
            <p className="text-xs text-muted-foreground">Errors</p>
          </div>
        </div>
      )}

      {done && (
        <>
          {/* Success/error message */}
          {errorList.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
              <CheckCircle2 className="size-5 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {isFormResponses
                  ? "All form responses imported successfully!"
                  : "All rows imported successfully!"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {successCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
                  <CheckCircle2 className="size-5 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    {isFormResponses
                      ? `${frResults.created} form response(s) imported successfully.`
                      : `${results.created + results.updated} prospect(s) imported successfully.`}{" "}
                    {errorList.length} row(s) had errors and were skipped.
                  </p>
                </div>
              )}
              {successCount === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                  <AlertCircle className="size-5 text-destructive" />
                  <p className="text-sm font-medium text-destructive">
                    Import failed — all {errorList.length} row(s) had errors.{" "}
                    {isFormResponses ? "No form responses were imported." : "No prospects were imported."}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <AlertCircle className="size-5 text-amber-500" />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {errorList.length} row(s) could not be imported — see details below.
                </p>
              </div>

              {/* Error list */}
              <div className="max-h-48 overflow-y-auto rounded border bg-muted/30 p-3">
                {errorList.slice(0, 20).map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    Row {err.row}: {err.error}
                  </p>
                ))}
                {errorList.length > 20 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ...and {errorList.length - 20} more
                  </p>
                )}
              </div>

              <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                <Download className="mr-2 size-4" />
                Download Error Report
              </Button>
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/prospects">
                View Prospects
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button variant="outline" onClick={onImportAnother}>
              <RotateCcw className="mr-2 size-4" />
              Import Another File
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

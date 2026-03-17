"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { chunkArray } from "@/lib/import-utils";
import type { ParsedBankRow } from "@/lib/bank-import-utils";
import Link from "next/link";

interface StepProgressProps {
  rows: ParsedBankRow[];
  onDone: () => void;
  onReset: () => void;
}

interface ImportResults {
  inserted: number;
  skipped: number;
  errors: string[];
  totalBatches: number;
  completedBatches: number;
}

export function StepProgress({ rows, onDone, onReset }: StepProgressProps) {
  const [results, setResults] = useState<ImportResults>({
    inserted: 0,
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

    async function run() {
      const batches = chunkArray(rows, 50);
      const totals: ImportResults = {
        inserted: 0,
        skipped: 0,
        errors: [],
        totalBatches: batches.length,
        completedBatches: 0,
      };

      setResults({ ...totals });

      for (const batch of batches) {
        try {
          const res = await fetch("/api/finance/bank-import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rows: batch.map((r) => ({
                date: r.date,
                description: r.description,
                type: r.type,
                amount: r.amount,
                category: r.category,
                gst_applicable: r.gst_applicable,
                reference: r.reference,
              })),
              config: { skip_zero_amounts: true },
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Request failed" }));
            totals.errors.push(err.error || "Batch failed");
            totals.skipped += batch.length;
          } else {
            const data = await res.json();
            totals.inserted += data.inserted ?? 0;
            totals.skipped += data.skipped ?? 0;
            if (data.errors?.length) {
              totals.errors.push(...data.errors);
            }
          }
        } catch {
          totals.errors.push("Network error — batch failed");
          totals.skipped += batch.length;
        }

        totals.completedBatches += 1;
        setResults({ ...totals });
      }

      setDone(true);
      onDone();
    }

    run();
  }, [rows, onDone]);

  const progress =
    results.totalBatches > 0
      ? Math.round((results.completedBatches / results.totalBatches) * 100)
      : 0;

  const hasErrors = results.errors.length > 0;
  const isSuccess = done && !hasErrors;

  return (
    <div className="space-y-6">
      <div className="text-center">
        {done ? (
          isSuccess ? (
            <CheckCircle2 className="mx-auto size-12 text-green-500" />
          ) : (
            <XCircle className="mx-auto size-12 text-amber-500" />
          )
        ) : (
          <div className="mx-auto size-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
        )}

        <h2 className="mt-3 text-base font-medium">
          {done
            ? isSuccess
              ? "Import Complete"
              : "Import Finished with Issues"
            : "Importing Transactions..."
          }
        </h2>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Batch {results.completedBatches} of {results.totalBatches}
          </span>
          <span>{progress}%</span>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-2xl font-semibold text-green-600">{results.inserted}</p>
          <p className="text-xs text-muted-foreground">Imported</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-2xl font-semibold text-muted-foreground">{results.skipped}</p>
          <p className="text-xs text-muted-foreground">Skipped</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className={`text-2xl font-semibold ${hasErrors ? "text-destructive" : "text-muted-foreground"}`}>
            {results.errors.length}
          </p>
          <p className="text-xs text-muted-foreground">Errors</p>
        </div>
      </div>

      {/* Error list */}
      {hasErrors && (
        <div className="max-h-[150px] overflow-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="mb-1 text-xs font-medium text-destructive">Errors:</p>
          {results.errors.slice(0, 20).map((err, i) => (
            <p key={i} className="text-xs text-destructive/80">
              {err}
            </p>
          ))}
          {results.errors.length > 20 && (
            <p className="text-xs text-destructive/60">
              ...and {results.errors.length - 20} more
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      {done && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="mr-1.5 size-4" />
            Import Another
          </Button>
          <Button asChild>
            <Link href="/finance/expenses">
              View Expenses
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

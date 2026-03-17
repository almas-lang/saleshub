"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { BankColumnMapping, BankImportField } from "@/lib/bank-import-utils";

const FIELD_OPTIONS: { value: BankImportField; label: string }[] = [
  { value: "__skip__", label: "Skip" },
  { value: "date", label: "Date" },
  { value: "description", label: "Description" },
  { value: "debit", label: "Debit (Withdrawal)" },
  { value: "credit", label: "Credit (Deposit)" },
  { value: "amount", label: "Amount (Single Column)" },
  { value: "balance", label: "Balance" },
  { value: "reference", label: "Reference / Cheque No." },
];

interface StepMapColumnsProps {
  headers: string[];
  sampleRows: Record<string, string>[];
  mappings: BankColumnMapping[];
  onMappingsChange: (mappings: BankColumnMapping[]) => void;
  error: string | null;
}

export function StepMapColumns({
  headers,
  sampleRows,
  mappings,
  onMappingsChange,
  error,
}: StepMapColumnsProps) {
  const handleFieldChange = (csvColumn: string, field: BankImportField) => {
    const updated = mappings.map((m) =>
      m.csvColumn === csvColumn ? { ...m, field, autoDetected: false } : m
    );
    onMappingsChange(updated);
  };

  // Track which fields are already mapped (except __skip__)
  const usedFields = new Set(
    mappings.filter((m) => m.field !== "__skip__").map((m) => m.field)
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-medium">Map Columns</h2>
        <p className="text-sm text-muted-foreground">
          Match each column from your bank statement to the correct field. Auto-detected mappings are shown — adjust if needed.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">CSV Column</TableHead>
              <TableHead className="w-[220px]">Map To</TableHead>
              <TableHead>Sample Values</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((header) => {
              const mapping = mappings.find((m) => m.csvColumn === header);
              const currentField = mapping?.field ?? "__skip__";

              return (
                <TableRow key={header}>
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-2">
                      {header}
                      {mapping?.autoDetected && currentField !== "__skip__" && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          auto
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={currentField}
                      onValueChange={(val) =>
                        handleFieldChange(header, val as BankImportField)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            disabled={
                              opt.value !== "__skip__" &&
                              opt.value !== currentField &&
                              usedFields.has(opt.value)
                            }
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex gap-3">
                      {sampleRows.slice(0, 3).map((row, i) => (
                        <span
                          key={i}
                          className="max-w-[120px] truncate"
                          title={row[header]}
                        >
                          {row[header] || "—"}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

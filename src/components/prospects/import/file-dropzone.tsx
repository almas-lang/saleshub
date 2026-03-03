"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ParsedFile } from "@/types/import";

interface FileDropzoneProps {
  parsedFile: ParsedFile | null;
  onFileParsed: (file: ParsedFile) => void;
  onRemove: () => void;
  onParseFile: (file: File) => Promise<ParsedFile>;
  error: string | null;
}

export function FileDropzone({
  parsedFile,
  onFileParsed,
  onRemove,
  onParseFile,
  error,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setParsing(true);
      try {
        const result = await onParseFile(file);
        onFileParsed(result);
      } catch {
        // Error is handled in parent
      } finally {
        setParsing(false);
      }
    },
    [onParseFile, onFileParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [handleFile]
  );

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (parsedFile) {
    return (
      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
        <FileSpreadsheet className="size-10 text-primary" />
        <div className="flex-1">
          <p className="font-medium">{parsedFile.name}</p>
          <p className="text-sm text-muted-foreground">
            {parsedFile.totalRows.toLocaleString()} rows &middot;{" "}
            {parsedFile.headers.length} columns &middot;{" "}
            {formatSize(parsedFile.size)}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          parsing && "pointer-events-none opacity-60"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload
          className={cn(
            "size-10",
            dragging ? "text-primary" : "text-muted-foreground"
          )}
        />
        <div className="text-center">
          <p className="font-medium">
            {parsing ? "Parsing file..." : "Drop your file here, or click to browse"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Supports CSV, XLSX, and XLS files
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleInputChange}
      />
      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

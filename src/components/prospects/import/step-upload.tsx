"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "./file-dropzone";
import { parseCSVFile, parseXLSXFile } from "@/lib/import-utils";
import type { ParsedFile } from "@/types/import";

interface StepUploadProps {
  parsedFile: ParsedFile | null;
  onFileParsed: (file: ParsedFile) => void;
  onRemove: () => void;
}

export function StepUpload({ parsedFile, onFileParsed, onRemove }: StepUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const handleParseFile = useCallback(async (file: File): Promise<ParsedFile> => {
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      const msg = "Unsupported file type. Please upload a CSV, XLSX, or XLS file.";
      setError(msg);
      throw new Error(msg);
    }

    try {
      const result =
        ext === "csv" ? await parseCSVFile(file) : await parseXLSXFile(file);

      if (result.totalRows === 0) {
        const msg = "The file appears to be empty. Please upload a file with data.";
        setError(msg);
        throw new Error(msg);
      }

      return result;
    } catch (err) {
      if (err instanceof Error && !error) {
        setError(err.message);
      }
      throw err;
    }
  }, [error]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Upload your file</h3>
        <p className="text-sm text-muted-foreground">
          Upload a CSV or Excel file containing your prospect data.
        </p>
      </div>
      <FileDropzone
        parsedFile={parsedFile}
        onFileParsed={onFileParsed}
        onRemove={onRemove}
        onParseFile={handleParseFile}
        error={error}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";

interface UseExportOptions {
  type: string;
  filters?: Record<string, string>;
}

export function useExport({ type, filters }: UseExportOptions) {
  const [loading, setLoading] = useState(false);

  const exportData = async (format: "csv" | "xlsx") => {
    setLoading(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, filters, format }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filename =
        disposition?.match(/filename="?([^"]+)"?/)?.[1] ??
        `export.${format}`;

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Export downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return { exportData, loading };
}

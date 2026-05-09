/**
 * Export data to CSV or XLSX format.
 * CSV uses built-in encoding; XLSX uses the `xlsx` package (already in deps).
 */

export function exportToCSV(
  rows: Record<string, unknown>[],
  filename: string
): { buffer: Buffer; contentType: string; filename: string } {
  if (rows.length === 0) {
    return {
      buffer: Buffer.from(""),
      contentType: "text/csv",
      filename: `${filename}.csv`,
    };
  }

  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          // Escape if contains comma, quote, or newline
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];

  return {
    buffer: Buffer.from(csvRows.join("\n"), "utf-8"),
    contentType: "text/csv",
    filename: `${filename}.csv`,
  };
}

export async function exportToXLSX(
  rows: Record<string, unknown>[],
  filename: string
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return {
    buffer: buf as Buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${filename}.xlsx`,
  };
}

/**
 * Export multi-sheet XLSX workbook.
 * Each sheet can have optional header rows above the data table.
 */
export interface SheetData {
  name: string;
  headerRows?: (string | number | null)[][];
  rows: Record<string, unknown>[];
}

export async function exportMultiSheetXLSX(
  sheets: SheetData[],
  filename: string
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    // Build array-of-arrays: header rows + column headers + data rows
    const aoa: (string | number | null)[][] = [];

    // Add header rows (company info, etc.)
    if (sheet.headerRows) {
      for (const row of sheet.headerRows) {
        aoa.push(row);
      }
    }

    if (sheet.rows.length > 0) {
      // Column headers from the first data row
      const columns = Object.keys(sheet.rows[0]);
      aoa.push(columns);

      // Data rows
      for (const row of sheet.rows) {
        aoa.push(columns.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return null;
          return val as string | number;
        }));
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-size columns (approximate)
    if (aoa.length > 0) {
      const maxCols = Math.max(...aoa.map((r) => r.length));
      ws["!cols"] = Array.from({ length: maxCols }, (_, i) => {
        const maxWidth = aoa.reduce((max, row) => {
          const cell = row[i];
          const len = cell != null ? String(cell).length : 0;
          return Math.max(max, len);
        }, 8);
        return { wch: Math.min(maxWidth + 2, 40) };
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return {
    buffer: buf as Buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${filename}.xlsx`,
  };
}

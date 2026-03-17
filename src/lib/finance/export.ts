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

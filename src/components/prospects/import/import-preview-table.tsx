"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ImportPreviewTableProps {
  headers: string[];
  rows: Record<string, string>[];
  maxRows?: number;
}

export function ImportPreviewTable({
  headers,
  rows,
  maxRows = 5,
}: ImportPreviewTableProps) {
  const previewRows = rows.slice(0, maxRows);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-12 text-center text-xs">#</TableHead>
            {headers.map((header) => (
              <TableHead
                key={header}
                className="max-w-[180px] truncate text-xs"
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {previewRows.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="text-center text-xs text-muted-foreground">
                {i + 1}
              </TableCell>
              {headers.map((header) => (
                <TableCell
                  key={header}
                  className="max-w-[180px] truncate text-sm"
                >
                  {row[header] || (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > maxRows && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Showing {maxRows} of {rows.length.toLocaleString()} rows
        </p>
      )}
    </div>
  );
}

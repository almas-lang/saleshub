"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LogEntry {
  id: string;
  level: string;
  source: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const LEVEL_STYLES: Record<string, string> = {
  debug: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  warn: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const PAGE_SIZE = 50;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState("all");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<LogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (level !== "all") params.set("level", level);
      if (source !== "all") params.set("source", source);
      if (search) params.set("search", search);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));

      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch {
      console.error("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }, [level, source, search, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleClearOld = async () => {
    if (!confirm("Delete logs older than 7 days?")) return;
    await fetch("/api/logs?older_than_days=7", { method: "DELETE" });
    fetchLogs();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Collect unique sources from current results for the filter
  const sources = ["all", "whatsapp-api", "whatsapp-webhook", "drip-processor", "auto-enroll", "email"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">System Logs</h2>
          <p className="text-sm text-muted-foreground">
            Internal logs from campaigns, WhatsApp API, and background jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearOld} className="text-red-500 hover:text-red-600">
            <Trash2 className="h-4 w-4 mr-1" />
            Clear old
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={level} onValueChange={(v) => { setLevel(v); setPage(0); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>

        <Select value={source} onValueChange={(v) => { setSource(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All sources" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>

        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {total} log{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[140px]">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Time</span>
              </TableHead>
              <TableHead className="w-[70px]">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Level</span>
              </TableHead>
              <TableHead className="w-[140px]">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Source</span>
              </TableHead>
              <TableHead>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Message</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="h-10 cursor-pointer hover:bg-muted/50"
                  onClick={() => setViewing(log)}
                >
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(log.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px] font-medium uppercase border-0", LEVEL_STYLES[log.level])}>
                      {log.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {log.source}
                  </TableCell>
                  <TableCell className="text-sm truncate max-w-[400px]">
                    {log.message}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  <Badge className={cn("text-[10px] font-medium uppercase border-0", LEVEL_STYLES[viewing.level])}>
                    {viewing.level}
                  </Badge>
                  <span className="font-mono text-sm text-muted-foreground">{viewing.source}</span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(viewing.created_at).toLocaleString()}
                </p>
              </DialogHeader>
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
                  <p className="text-sm">{viewing.message}</p>
                </div>
                {viewing.metadata && Object.keys(viewing.metadata).length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Metadata</p>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 rounded p-2 max-h-[300px] overflow-y-auto">
                      {JSON.stringify(viewing.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

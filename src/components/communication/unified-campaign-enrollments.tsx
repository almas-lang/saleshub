"use client";

import { useState, useEffect } from "react";
import { Users, Play, CheckCircle2, XCircle, Pause, Loader2 } from "lucide-react";
import { safeFetch } from "@/lib/fetch";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Enrollment {
  id: string;
  contact_id: string;
  status: string;
  current_step_order: number;
  next_send_at: string | null;
  created_at: string;
  contact: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

interface Stats {
  total: number;
  active: number;
  completed: number;
  stopped: number;
  paused: number;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  stopped: { label: "Stopped", variant: "destructive" },
  paused: { label: "Paused", variant: "outline" },
};

export function UnifiedCampaignEnrollments({ campaignId }: { campaignId: string }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, completed: 0, stopped: 0, paused: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    safeFetch<{ enrollments: Enrollment[]; stats: Stats }>(
      `/api/campaigns/unified/enrollments?campaign_id=${campaignId}`
    ).then((res) => {
      setLoading(false);
      if (res.ok && res.data) {
        setEnrollments(res.data.enrollments);
        setStats(res.data.stats);
      }
    });
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Play className="size-4 text-blue-500" />
              <span className="text-2xl font-bold">{stats.active}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span className="text-2xl font-bold">{stats.completed}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Stopped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="size-4 text-red-500" />
              <span className="text-2xl font-bold">{stats.stopped + stats.paused}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrollments table */}
      {enrollments.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">No contacts enrolled yet.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Step</TableHead>
                <TableHead className="hidden md:table-cell">Next Send</TableHead>
                <TableHead className="hidden lg:table-cell">Enrolled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((e) => {
                const statusStyle = STATUS_BADGE[e.status] ?? { label: e.status, variant: "outline" as const };
                const contactName = [e.contact?.first_name, e.contact?.last_name].filter(Boolean).join(" ") || "Unknown";
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{contactName}</p>
                        <p className="text-xs text-muted-foreground">{e.contact?.email || e.contact?.phone || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusStyle.variant}>{statusStyle.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">Step {e.current_step_order}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {e.next_send_at && e.status === "active" ? formatDateTime(e.next_send_at) : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">{formatDateTime(e.created_at)}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

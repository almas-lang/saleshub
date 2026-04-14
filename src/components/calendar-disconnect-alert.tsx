"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface DisconnectedMember {
  id: string;
  name: string | null;
  email: string;
  google_disconnect_reason?: string | null;
  google_disconnected_at?: string | null;
}

export function CalendarDisconnectAlert({
  members,
}: {
  members: DisconnectedMember[];
}) {
  const [open, setOpen] = useState(true);
  if (members.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-red-500/40">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2 text-red-500">
            <AlertTriangle className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Action required
            </span>
          </div>
          <DialogTitle>Google Calendar disconnected</DialogTitle>
          <DialogDescription>
            Bookings cannot show available time slots until this is reconnected.
          </DialogDescription>
        </DialogHeader>

        <ul className="my-3 space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
          {members.map((m) => (
            <li key={m.id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-red-500" />
                <span className="font-medium">{m.name ?? m.email}</span>
                <span className="text-muted-foreground">— {m.email}</span>
              </div>
              {m.google_disconnect_reason && (
                <div className="ml-3.5 text-xs text-muted-foreground">
                  Reason: <span className="font-mono">{m.google_disconnect_reason}</span>
                  {m.google_disconnected_at && (
                    <> · {new Date(m.google_disconnected_at).toLocaleString()}</>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Dismiss
          </Button>
          <Button asChild>
            <Link href="/settings/integrations/connect">Reconnect now</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

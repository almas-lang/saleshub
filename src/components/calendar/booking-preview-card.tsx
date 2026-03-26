"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, CalendarDays, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BookingPreviewCardProps {
  slug: string;
  totalBookings: number;
  upcomingBookings: number;
}

export function BookingPreviewCard({
  slug,
  totalBookings,
  upcomingBookings,
}: BookingPreviewCardProps) {
  const [copied, setCopied] = useState(false);
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/book/${slug}`;

  function handleCopy() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
            <ExternalLink className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Public Booking Link
            </p>
            <p className="truncate text-sm font-mono text-foreground">
              /book/{slug}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 sm:flex">
            <Badge variant="secondary" className="gap-1.5">
              <CalendarDays className="size-3" />
              {totalBookings} total
            </Badge>
            <Badge variant="secondary" className="gap-1.5 bg-emerald-500/10 text-emerald-600">
              <CalendarClock className="size-3" />
              {upcomingBookings} upcoming
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="mr-1.5 size-3.5" />
            ) : (
              <Copy className="mr-1.5 size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button size="sm" asChild>
            <a href={`/book/${slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 size-3.5" />
              Preview
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { CalendarX, ExternalLink, Calendar } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { BookingWithRelations } from "@/types/bookings";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  completed: "secondary",
  no_show: "destructive",
  cancelled: "outline",
};

function contactName(contact: BookingWithRelations["contacts"]) {
  if (!contact) return "Unknown";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
}

function BookingTable({ bookings, emptyTitle, emptyDescription }: {
  bookings: BookingWithRelations[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prospect</TableHead>
              <TableHead>Booking Page</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  {b.contacts ? (
                    <Link
                      href={`/prospects/${b.contacts.id}`}
                      className="font-medium hover:underline"
                    >
                      {contactName(b.contacts)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                  {b.contacts?.email && (
                    <p className="text-xs text-muted-foreground">{b.contacts.email}</p>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {b.booking_pages?.title ?? "—"}
                </TableCell>
                <TableCell>{formatDateTime(b.starts_at)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[b.status] ?? "outline"} className="text-[11px]">
                    {b.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {b.meet_link && (
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                      <a href={b.meet_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 lg:hidden">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                {b.contacts ? (
                  <Link
                    href={`/prospects/${b.contacts.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {contactName(b.contacts)}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Unknown</span>
                )}
                {b.contacts?.email && (
                  <p className="text-xs text-muted-foreground">{b.contacts.email}</p>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[b.status] ?? "outline"} className="text-[11px] shrink-0">
                {b.status.replace("_", " ")}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDateTime(b.starts_at)}</span>
              {b.booking_pages && <span>{b.booking_pages.title}</span>}
            </div>
            {b.meet_link && (
              <a
                href={b.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                Join meeting
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export function BookingsSection({ upcoming, past }: {
  upcoming: BookingWithRelations[];
  past: BookingWithRelations[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Bookings</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          All scheduled and past bookings across your booking pages.
        </p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList variant="line">
          <TabsTrigger value="upcoming">
            Upcoming
            {upcoming.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {upcoming.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="past">
            Past
            {past.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {past.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          <BookingTable
            bookings={upcoming}
            emptyTitle="No upcoming bookings"
            emptyDescription="Bookings will appear here once prospects schedule calls through your booking pages."
          />
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          <BookingTable
            bookings={past}
            emptyTitle="No past bookings"
            emptyDescription="Completed and past bookings will show up here."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

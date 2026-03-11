"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Calendar,
  ExternalLink,
  Copy,
  Clock,
  Users,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch, throwOnError } from "@/lib/fetch";
import type { BookingPageWithCount } from "@/types/bookings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BookingPageForm } from "./booking-page-form";

export function BookingPageList({ pages }: { pages: BookingPageWithCount[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<BookingPageWithCount | null>(null);
  const [deletePage, setDeletePage] = useState<BookingPageWithCount | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  function handleDelete() {
    if (!deletePage) return;
    const page = deletePage;
    setDeletePage(null);

    // Optimistic removal with animation
    setRemovedIds((prev) => new Set(prev).add(page.id));

    throwOnError(safeFetch(`/api/booking-pages/${page.id}`, { method: "DELETE" }))
      .then(() => {
        toast.success("Booking page deleted");
        router.refresh();
      })
      .catch((err) => {
        // Rollback on failure
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(page.id);
          return next;
        });
        toast.error(err.message);
      });
  }

  const visiblePages = pages.filter((p) => !removedIds.has(p.id));

  function copyLink(slug: string) {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 size-4" />
          Create booking page
        </Button>
      </div>

      {visiblePages.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 shadow-sm">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <Calendar className="size-8 text-primary" />
          </div>
          <CardTitle className="mt-5 mb-1.5">No booking pages yet</CardTitle>
          <CardDescription className="max-w-xs text-center">
            Create your first booking page to start accepting call bookings from prospects.
          </CardDescription>
          <Button className="mt-5" onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 size-4" />
            Create booking page
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePages.map((page) => (
            <Card
              key={page.id}
              className="group relative cursor-pointer shadow-sm transition-all duration-150 hover:border-foreground/20 hover:shadow-md"
              onClick={() => router.push(`/calendar/${page.id}`)}
            >
              <div className="p-5">
                {/* Top row: icon + status + menu */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Calendar className="size-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={page.is_active ? "default" : "outline"}
                      className="text-[11px]"
                    >
                      {page.is_active ? "Active" : "Draft"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPage(page);
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLink(page.slug);
                          }}
                        >
                          <Copy className="mr-2 size-4" />
                          Copy link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/book/${page.slug}`, "_blank");
                          }}
                        >
                          <ExternalLink className="mr-2 size-4" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletePage(page);
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Title + description */}
                <div className="mt-3.5">
                  <h3 className="text-[15px] font-semibold leading-snug">{page.title}</h3>
                  {page.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {page.description}
                    </p>
                  )}
                </div>

                {/* Stats row */}
                <div className="mt-4 flex items-center gap-4 text-[13px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    {page.duration_minutes} min
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {page.booking_count} booking{page.booking_count !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Link row */}
                <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5">
                  <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    /book/{page.slug}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyLink(page.slug);
                    }}
                    className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deletePage}
        onOpenChange={(open) => {
          if (!open) setDeletePage(null);
        }}
        title={`Delete "${deletePage?.title}"?`}
        description={
          deletePage?.booking_count
            ? `This page has ${deletePage.booking_count} booking${deletePage.booking_count !== 1 ? "s" : ""}. The public link will stop working but existing bookings and calendar events are preserved.`
            : "This will permanently delete this booking page and its public link."
        }
        onConfirm={handleDelete}
        destructive
      />

      <BookingPageForm
        open={formOpen || !!editingPage}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingPage(null);
          }
        }}
        page={editingPage}
      />
    </>
  );
}

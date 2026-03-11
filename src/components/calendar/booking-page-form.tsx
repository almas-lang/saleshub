"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { DURATION_OPTIONS } from "@/lib/constants";
import type { BookingPageWithCount } from "@/types/bookings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const quickSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: z.string().min(1, "Slug is required").max(100),
  duration_minutes: z.number().int().min(15).max(480),
});

type QuickValues = z.infer<typeof quickSchema>;

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface BookingPageFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: BookingPageWithCount | null;
}

export function BookingPageForm({ open, onOpenChange, page }: BookingPageFormProps) {
  const router = useRouter();
  const isEditing = !!page;

  const form = useForm<QuickValues>({
    resolver: zodResolver(quickSchema),
    defaultValues: {
      title: page?.title ?? "",
      slug: page?.slug ?? "",
      duration_minutes: page?.duration_minutes ?? 30,
    },
  });

  // Reset form when page prop changes
  useEffect(() => {
    if (open) {
      form.reset({
        title: page?.title ?? "",
        slug: page?.slug ?? "",
        duration_minutes: page?.duration_minutes ?? 30,
      });
    }
  }, [open, page, form]);

  // Auto-generate slug from title (only when creating)
  const title = form.watch("title");
  useEffect(() => {
    if (!isEditing && title) {
      form.setValue("slug", slugify(title), { shouldValidate: true });
    }
  }, [title, isEditing, form]);

  async function onSubmit(values: QuickValues) {
    if (isEditing) {
      const result = await safeFetch(`/api/booking-pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Booking page updated");
    } else {
      const result = await safeFetch("/api/booking-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Booking page created");
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Booking Page" : "Create Booking Page"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the booking page details."
              : "Create a new booking page. Default form fields and availability will be added."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Design Career Strategy Call" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">/book/</span>
                      <Input
                        placeholder="design-career-strategy-call"
                        {...field}
                        onChange={(e) =>
                          field.onChange(slugify(e.target.value))
                        }
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(parseInt(v))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DURATION_OPTIONS.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d} minutes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

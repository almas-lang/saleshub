"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { funnelSchema, type FunnelValues } from "@/lib/validations";
import { DEFAULT_VSL_STAGES, DEFAULT_WEBINAR_STAGES } from "@/lib/constants";
import type { Funnel, SalesType } from "@/types/funnels";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const SALES_TYPES: { value: SalesType; label: string }[] = [
  { value: "vsl", label: "VSL" },
  { value: "webinar", label: "Webinar" },
  { value: "workshop", label: "Workshop" },
  { value: "short_course", label: "Short Course" },
  { value: "direct_outreach", label: "Direct Outreach" },
  { value: "custom", label: "Custom" },
];

function getDefaultStages(salesType: string) {
  if (salesType === "vsl") {
    return DEFAULT_VSL_STAGES.map((s) => ({
      name: s.name,
      order: s.order,
      color: s.color,
      is_terminal: "isTerminal" in s ? s.isTerminal : false,
    }));
  }
  if (salesType === "webinar") {
    return DEFAULT_WEBINAR_STAGES.map((s) => ({
      name: s.name,
      order: s.order,
      color: s.color,
      is_terminal: "isTerminal" in s ? s.isTerminal : false,
    }));
  }
  return [
    { name: "New Lead", order: 1, color: "#94A3B8", is_terminal: false },
    { name: "Converted", order: 2, color: "#34D399", is_terminal: true },
    { name: "Lost", order: 3, color: "#EF4444", is_terminal: true },
  ];
}

interface FunnelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnel: Funnel | null;
}

export function FunnelForm({ open, onOpenChange, funnel }: FunnelFormProps) {
  const router = useRouter();
  const isEditing = !!funnel;

  const form = useForm<FunnelValues>({
    resolver: zodResolver(funnelSchema),
    defaultValues: {
      name: funnel?.name ?? "",
      description: funnel?.description ?? "",
      sales_type: funnel?.sales_type ?? "vsl",
    },
  });

  // Reset form when funnel prop changes
  if (funnel && form.getValues("name") !== funnel.name) {
    form.reset({
      name: funnel.name,
      description: funnel.description ?? "",
      sales_type: funnel.sales_type,
    });
  }

  async function onSubmit(values: FunnelValues) {
    if (isEditing) {
      const result = await safeFetch(`/api/funnels/${funnel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Funnel updated");
    } else {
      const stages = getDefaultStages(values.sales_type);

      const result = await safeFetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, stages }),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Funnel created");
    }

    form.reset({ name: "", description: "", sales_type: "vsl" });
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Funnel" : "Create Funnel"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the funnel details."
              : "Create a new sales funnel. Default stages will be added based on the sales type."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. VSL Lead Magnet Flow" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe this funnel..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sales_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sales Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SALES_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
                    : "Create Funnel"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { safeFetch } from "@/lib/fetch";
import {
  businessProfileSchema,
  type BusinessProfileValues,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface BusinessProfileFormProps {
  initialData: BusinessProfileValues & { logo_url?: string };
}

export function BusinessProfileForm({ initialData }: BusinessProfileFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initialData.logo_url ?? "");
  const [uploading, setUploading] = useState(false);

  const form = useForm<BusinessProfileValues>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      business_name: initialData.business_name ?? "",
      gst_number: initialData.gst_number ?? "",
      address_line1: initialData.address_line1 ?? "",
      address_line2: initialData.address_line2 ?? "",
      city: initialData.city ?? "",
      state: initialData.state ?? "",
      pincode: initialData.pincode ?? "",
      support_email: initialData.support_email ?? "",
      default_sender_name: initialData.default_sender_name ?? "",
      logo_url: initialData.logo_url ?? "",
    },
  });

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/settings/profile/logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }

      setLogoUrl(data.url);
      form.setValue("logo_url", data.url);
      toast.success("Logo uploaded");
    } catch {
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: BusinessProfileValues) {
    const result = await safeFetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Business profile updated");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Logo */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold">Logo</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Upload your company logo (max 2 MB).
          </p>
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex size-20 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-background transition-colors hover:border-foreground/30"
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="size-full object-contain"
                />
              ) : (
                <Upload className="size-5 text-muted-foreground" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoUpload}
            />
            {uploading && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Recommended: 200x200px, PNG or SVG. Max 2 MB.
          </p>
        </div>

        {/* Business Details */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold">Business Details</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gst_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GST Number</FormLabel>
                  <FormControl>
                    <Input placeholder="22AAAAA0000A1Z5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="support_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Support Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="support@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="default_sender_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Sender Name</FormLabel>
                <FormControl>
                  <Input placeholder="Xperience Wave" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Address */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold">Address</h2>

          <FormField
            control={form.control}
            name="address_line1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1</FormLabel>
                <FormControl>
                  <Input placeholder="123 Business St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address_line2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 2</FormLabel>
                <FormControl>
                  <Input placeholder="Suite 100" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="Bangalore" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input placeholder="Karnataka" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pincode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pincode</FormLabel>
                  <FormControl>
                    <Input placeholder="560001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { DURATION_OPTIONS, DEFAULT_AVAILABILITY_RULES } from "@/lib/constants";
import type {
  BookingPageWithCount,
  FormField,
  AvailabilityRules,
  TeamMember,
} from "@/types/bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormFieldEditor } from "./form-field-editor";
import { AvailabilityEditor } from "./availability-editor";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface BookingPageBuilderProps {
  page: BookingPageWithCount;
  teamMembers: TeamMember[];
}

export function BookingPageBuilder({ page, teamMembers }: BookingPageBuilderProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Basic details
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [description, setDescription] = useState(page.description ?? "");
  const [durationMinutes, setDurationMinutes] = useState(page.duration_minutes);
  const [isActive, setIsActive] = useState(page.is_active);

  // Team assignment
  const [assignedTo, setAssignedTo] = useState<string[]>(page.assigned_to ?? []);

  // Availability
  const [availability, setAvailability] = useState<AvailabilityRules>(
    (page.availability_rules as unknown as AvailabilityRules) ?? DEFAULT_AVAILABILITY_RULES
  );

  // Form fields
  const [formFields, setFormFields] = useState<FormField[]>(
    (page.form_fields as unknown as FormField[]) ?? []
  );

  // Redirect URL after booking
  const [redirectUrl, setRedirectUrl] = useState(page.redirect_url ?? "");

  // Confirmation toggles
  const [confirmEmail, setConfirmEmail] = useState(page.confirmation_email ?? false);
  const [confirmWa, setConfirmWa] = useState(page.confirmation_wa ?? false);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function handleTeamToggle(memberId: string, checked: boolean) {
    setAssignedTo((prev) =>
      checked ? [...prev, memberId] : prev.filter((id) => id !== memberId)
    );
    markDirty();
  }

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!slug.trim()) {
      toast.error("Slug is required");
      return;
    }
    if (!formFields.some((f) => f.type === "email")) {
      toast.error("An email field is required for bookings to work");
      return;
    }

    setSaving(true);

    const result = await safeFetch(`/api/booking-pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        duration_minutes: durationMinutes,
        is_active: isActive,
        assigned_to: assignedTo.length > 0 ? assignedTo : null,
        availability_rules: availability,
        form_fields: formFields,
        redirect_url: redirectUrl.trim() || null,
        confirmation_email: confirmEmail,
        confirmation_wa: confirmWa,
      }),
    });

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Changes saved");
    setDirty(false);
    router.refresh();
  }, [
    title, slug, description, durationMinutes, isActive,
    assignedTo, availability, formFields, redirectUrl, confirmEmail, confirmWa,
    page.id, router,
  ]);

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/calendar">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{page.title}</h1>
            <Badge variant={isActive ? "default" : "outline"}>
              {isActive ? "Active" : "Draft"}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            /book/{page.slug}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="active-toggle" className="text-sm">
              Active
            </Label>
            <Switch
              id="active-toggle"
              checked={isActive}
              onCheckedChange={(v) => {
                setIsActive(v);
                markDirty();
              }}
            />
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/book/${page.slug}`} target="_blank">
              <ExternalLink className="mr-2 size-4" />
              Preview
            </Link>
          </Button>
        </div>
      </div>

      <Separator />

      <div className="mx-auto max-w-3xl space-y-8">
        {/* Basic Details */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Basic Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">/book/</span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value));
                    markDirty();
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select
                value={String(durationMinutes)}
                onValueChange={(v) => {
                  setDurationMinutes(parseInt(v));
                  markDirty();
                }}
              >
                <SelectTrigger id="duration" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markDirty();
              }}
              placeholder="What is this call about?"
              rows={3}
            />
          </div>
        </section>

        <Separator />

        {/* Team Assignment */}
        {teamMembers.length > 0 && (
          <>
            <section className="space-y-4">
              <h2 className="text-lg font-medium">Team Assignment</h2>
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
                  >
                    <Checkbox
                      checked={assignedTo.includes(member.id)}
                      onCheckedChange={(checked) =>
                        handleTeamToggle(member.id, checked === true)
                      }
                    />
                    <span className="text-sm font-medium">{member.name}</span>
                  </label>
                ))}
              </div>
            </section>
            <Separator />
          </>
        )}

        {/* Availability */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Availability</h2>
          <AvailabilityEditor
            rules={availability}
            onChange={(rules) => {
              setAvailability(rules);
              markDirty();
            }}
          />
        </section>

        <Separator />

        {/* Form Fields */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium">
            Form Fields ({formFields.length})
          </h2>
          <FormFieldEditor
            fields={formFields}
            onChange={(fields) => {
              setFormFields(fields);
              markDirty();
            }}
          />
        </section>

        <Separator />

        {/* Confirmation */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Confirmation</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="redirect-url" className="text-sm font-medium">
                Redirect URL after booking
              </Label>
              <Input
                id="redirect-url"
                type="url"
                value={redirectUrl}
                onChange={(e) => {
                  setRedirectUrl(e.target.value);
                  markDirty();
                }}
                placeholder="https://example.com/congratulations"
              />
              <p className="text-xs text-muted-foreground">
                Where to send the user after a successful booking. UTM params are appended automatically.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div>
                <p className="text-sm font-medium">Confirmation Email</p>
                <p className="text-xs text-muted-foreground">
                  Send an email confirmation after booking
                </p>
              </div>
              <Switch
                checked={confirmEmail}
                onCheckedChange={(v) => {
                  setConfirmEmail(v);
                  markDirty();
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div>
                <p className="text-sm font-medium">WhatsApp Confirmation</p>
                <p className="text-xs text-muted-foreground">
                  Send a WhatsApp message after booking
                </p>
              </div>
              <Switch
                checked={confirmWa}
                onCheckedChange={(v) => {
                  setConfirmWa(v);
                  markDirty();
                }}
              />
            </div>
          </div>
        </section>

        {/* Spacer for sticky bar */}
        <div className="h-16" />
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
            <p className="text-sm text-muted-foreground">
              You have unsaved changes
            </p>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

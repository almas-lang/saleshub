"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Video,
  Globe,
  User,
} from "lucide-react";
import { safeFetch } from "@/lib/fetch";
import { toast } from "sonner";
import type { FormField, AvailabilityRules, DaySchedule } from "@/types/bookings";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface TimeSlot {
  start: string;
  end: string;
  time: string;
  assignedTo: string;
}

interface BookingWidgetProps {
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  formFields: FormField[];
  availability: AvailabilityRules | null;
}

type Step = "date" | "time" | "form" | "confirmed";

export function BookingWidget({
  slug,
  title,
  description,
  durationMinutes,
  formFields,
  availability,
}: BookingWidgetProps) {
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState<number>(5);

  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const field of formFields) {
      if (field.defaultValue) {
        defaults[field.label] = field.defaultValue;
      }
    }
    setFormData(defaults);
  }, [formFields]);

  useEffect(() => {
    if (step !== "confirmed") return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          window.location.href = "https://ld.xperiencewave.com/congratulations";
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const fetchSlots = useCallback(
    async (date: Date) => {
      setLoadingSlots(true);
      setSlots([]);
      setSelectedSlot(null);

      const dateStr = format(date, "yyyy-MM-dd");
      const result = await safeFetch<{ data: TimeSlot[] }>(
        "/api/bookings/availability",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, date: dateStr }),
        }
      );

      setLoadingSlots(false);
      if (result.ok) setSlots(result.data.data);
    },
    [slug]
  );

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    setSelectedDate(date);
    fetchSlots(date);
    setStep("time");
  }

  function handleSlotSelect(slot: TimeSlot) {
    setSelectedSlot(slot);
    setStep("form");
  }

  function updateField(label: string, value: string) {
    setFormData((prev) => ({ ...prev, [label]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate all required fields (especially radio/select which HTML5 can't validate)
    const missing = new Set<string>();
    for (const field of formFields) {
      if (field.required && !formData[field.label]?.trim()) {
        missing.add(field.id);
      }
    }
    if (missing.size > 0) {
      setErrors(missing);
      toast.error("Please fill in all required fields");
      // Scroll to first missing field
      const firstId = Array.from(missing)[0];
      document.getElementById(`field-${firstId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors(new Set());

    if (!selectedDate || !selectedSlot) return;

    setSubmitting(true);
    const result = await safeFetch<{
      success: boolean;
      booking_id: string;
      meet_link: string | null;
    }>("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        date: format(selectedDate, "yyyy-MM-dd"),
        time: selectedSlot.time,
        assignedTo: selectedSlot.assignedTo,
        formData,
      }),
    });

    setSubmitting(false);
    if (result.ok) {
      setMeetLink(result.data.meet_link);
      setStep("confirmed");
    } else {
      toast.error(result.error || "Something went wrong. Please try again.");
    }
  }

  function isDayDisabled(date: Date): boolean {
    if (isBefore(date, startOfDay(new Date()))) return true;
    if (!availability) return true;
    const dayOfWeek = date.getDay();
    const daySchedule: DaySchedule | undefined = availability.schedule.find(
      (d) => d.day === dayOfWeek
    );
    if (!daySchedule || !daySchedule.enabled) return true;
    const dateStr = format(date, "yyyy-MM-dd");
    if (availability.blocked_dates.includes(dateStr)) return true;
    return false;
  }

  // Sidebar info — compact on mobile, full on md+
  const sidebar = (
    <div className="flex flex-col gap-3 border-b p-4 sm:gap-5 sm:p-6 md:w-72 md:shrink-0 md:border-b-0 md:border-r lg:w-80">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:size-9">
          <User className="size-3.5 sm:size-4" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">Xperience Wave</span>
      </div>

      {/* Title + meta: inline on mobile, stacked on md+ */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1.5 hidden text-sm leading-relaxed text-muted-foreground sm:mt-2 md:block">{description}</p>
        )}
      </div>

      {/* Meta pills — horizontal row on mobile, vertical on md+ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground md:flex-col md:items-start md:gap-2.5">
        <div className="flex items-center gap-1.5 md:gap-2">
          <Clock className="size-3.5 md:size-4" />
          <span>{durationMinutes} min</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <Video className="size-3.5 md:size-4" />
          <span>Google Meet</span>
        </div>
        {availability?.timezone && (
          <div className="flex items-center gap-1.5 md:gap-2">
            <Globe className="size-3.5 md:size-4" />
            <span>{availability.timezone.replace("_", " ")}</span>
          </div>
        )}
      </div>

      {/* Selected date/time summary */}
      {selectedDate && step !== "date" && (
        <div className="rounded-lg border bg-muted/40 p-2.5 sm:p-3">
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="size-4 text-primary" />
            <span className="font-medium">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
          </div>
          {selectedSlot && (
            <div className="mt-1 flex items-center gap-2 text-sm sm:mt-1.5">
              <Clock className="size-4 text-primary" />
              <span className="font-medium">{selectedSlot.time} IST</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-4xl overflow-hidden border-y bg-card sm:rounded-2xl sm:border sm:shadow-xl">
      <div className="flex flex-col md:flex-row md:min-h-[560px]">
        {sidebar}

        {/* Main content */}
        <div className="flex flex-1 flex-col">
          {/* Step indicator */}
          {step !== "confirmed" && (
            <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
              {step !== "date" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-1 h-7 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={() =>
                    setStep(step === "form" ? "time" : "date")
                  }
                >
                  <ArrowLeft className="size-3" />
                  Back
                </Button>
              )}
              <div className="flex flex-1 items-center justify-end gap-1.5">
                {(["date", "time", "form"] as const).map((s, i) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        s === step
                          ? "bg-primary text-primary-foreground"
                          : (["date", "time", "form"].indexOf(step) > i)
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </div>
                    {i < 2 && (
                      <div
                        className={`h-px w-4 transition-colors ${
                          (["date", "time", "form"].indexOf(step) > i)
                            ? "bg-primary/40"
                            : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* ── Step 1: Date ── */}
            {step === "date" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Select a Date</h2>
                  <p className="text-sm text-muted-foreground">Choose a day that works for you</p>
                </div>
                <div className="flex justify-center py-2">
                  <Calendar
                    mode="single"
                    fixedWeeks
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={isDayDisabled}
                    fromDate={new Date()}
                    toDate={addDays(new Date(), 60)}
                    className="w-full rounded-xl p-2 [--cell-size:2.5rem] sm:p-4 sm:[--cell-size:3rem]"
                    classNames={{
                      root: "w-full",
                      months: "flex flex-col w-full relative",
                      month: "flex flex-col w-full gap-3 sm:gap-4",
                      month_caption: "flex items-center justify-center h-10 w-full px-10 sm:h-12 sm:px-12",
                      caption_label: "text-sm font-semibold select-none sm:text-base",
                      weekdays: "flex w-full",
                      weekday: "text-muted-foreground flex-1 font-medium text-xs select-none sm:text-sm",
                      week: "flex w-full mt-0.5 sm:mt-1",
                      day: "relative flex-1 p-0 text-center group/day aspect-square select-none [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
                      today: "bg-primary/10 text-primary font-semibold rounded-lg data-[selected=true]:rounded-none",
                      disabled: "text-muted-foreground/60 cursor-not-allowed",
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── Step 2: Time ── */}
            {step === "time" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Select a Time</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </p>
                </div>

                {loadingSlots ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <Loader2 className="size-7 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading available times...</p>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <CalendarIcon className="size-10 text-muted-foreground/50" />
                    <div>
                      <p className="font-medium">No slots available</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Try selecting a different date
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setStep("date")}>
                      Pick another date
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {slots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => handleSlotSelect(slot)}
                        className="rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Form ── */}
            {step === "form" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">Enter Your Details</h2>
                  <p className="text-sm text-muted-foreground">
                    Please fill out the form to complete your booking
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {renderFormFields(formFields, formData, updateField, errors)}

                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="h-12 w-full text-base font-semibold"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        "Schedule Event"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Step 4: Confirmed ── */}
            {step === "confirmed" && (
              <div className="flex flex-col items-center justify-center gap-5 py-8 text-center">
                <div className="flex size-20 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/30">
                  <CheckCircle2 className="size-10 text-green-500" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
                  <p className="text-muted-foreground">
                    A calendar invitation has been sent to your email.
                  </p>
                </div>

                <div className="w-full max-w-sm space-y-3 rounded-xl border bg-muted/30 p-5 text-left">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="size-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">
                        {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedSlot?.time} IST &middot; {durationMinutes} min
                      </p>
                    </div>
                  </div>

                  {meetLink && (
                    <div className="flex items-start gap-3">
                      <Video className="mt-0.5 size-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Google Meet</p>
                        <a
                          href={meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary underline-offset-2 hover:underline break-all"
                        >
                          Join meeting
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Redirect countdown */}
                <div className="w-full max-w-sm space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Redirecting you in <span className="font-semibold tabular-nums text-foreground">{countdown}s</span>…</span>
                    <a
                      href="https://ld.xperiencewave.com/congratulations"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Go now →
                    </a>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-none"
                      style={{ width: `${((5 - countdown) / 5) * 100}%`, transition: "width 1s linear" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-3 text-center sm:px-6">
            <p className="text-xs text-muted-foreground">
              Powered by{" "}
              <a
                href="https://xperiencewave.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground/60 hover:text-foreground/80 transition-colors"
              >
                Xperience Wave
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Smart Form Field Renderer ──────────────────

function renderFormFields(
  fields: FormField[],
  formData: Record<string, string>,
  updateField: (label: string, value: string) => void,
  fieldErrors: Set<string>
) {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < fields.length) {
    const field = fields[i];
    const next = fields[i + 1];

    // Pair up short text fields side-by-side (e.g. First Name + Last Name)
    const isShortText = field.type === "text" && !field.label.includes("?") && field.label.length < 30;
    const nextIsShortText = next && next.type === "text" && !next.label.includes("?") && next.label.length < 30;

    if (isShortText && nextIsShortText) {
      elements.push(
        <div key={field.id} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormFieldInput
            field={field}
            value={formData[field.label] ?? ""}
            onChange={(v) => updateField(field.label, v)}
            hasError={fieldErrors.has(field.id)}
          />
          <FormFieldInput
            field={next}
            value={formData[next.label] ?? ""}
            onChange={(v) => updateField(next.label, v)}
            hasError={fieldErrors.has(next.id)}
          />
        </div>
      );
      i += 2;
    } else {
      elements.push(
        <FormFieldInput
          key={field.id}
          field={field}
          value={formData[field.label] ?? ""}
          onChange={(v) => updateField(field.label, v)}
          hasError={fieldErrors.has(field.id)}
        />
      );
      i += 1;
    }
  }

  return elements;
}

function FormFieldInput({
  field,
  value,
  onChange,
  hasError = false,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
}) {
  const id = `field-${field.id}`;

  return (
    <div id={id} className="space-y-2">
      <Label htmlFor={`${id}-input`} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {hasError && !value?.trim() && (
        <p className="text-xs text-destructive">This field is required</p>
      )}

      {field.type === "text" && (
        <Input
          id={`${id}-input`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className={`h-10 ${hasError && !value?.trim() ? "border-destructive" : ""}`}
        />
      )}

      {field.type === "email" && (
        <Input
          id={`${id}-input`}
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className={`h-10 ${hasError && !value?.trim() ? "border-destructive" : ""}`}
        />
      )}

      {field.type === "phone" && (
        <Input
          id={`${id}-input`}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className={`h-10 ${hasError && !value?.trim() ? "border-destructive" : ""}`}
        />
      )}

      {field.type === "textarea" && (
        <Textarea
          id={`${id}-input`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={3}
          className={`resize-none ${hasError && !value?.trim() ? "border-destructive" : ""}`}
        />
      )}

      {field.type === "select" && (
        <Select value={value} onValueChange={onChange} required={field.required}>
          <SelectTrigger id={`${id}-input`} className={`h-10 w-full ${hasError && !value?.trim() ? "border-destructive" : ""}`}>
            <SelectValue placeholder={field.placeholder || "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === "radio" && (
        <RadioGroup
          value={value}
          onValueChange={onChange}
          className="space-y-1"
        >
          {(field.options ?? []).map((opt) => (
            <label
              key={opt}
              htmlFor={`${id}-${opt}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors active:scale-[0.99] hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value={opt} id={`${id}-${opt}`} className="mt-0.5" />
              <span className="text-sm leading-snug">{opt}</span>
            </label>
          ))}
        </RadioGroup>
      )}
    </div>
  );
}

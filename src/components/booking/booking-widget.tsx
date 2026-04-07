"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  Phone,
  Mail,
  ChevronRight,
  Check,
} from "lucide-react";
import { safeFetch } from "@/lib/fetch";
import { toast } from "sonner";
import type { FormField, AvailabilityRules, DaySchedule } from "@/types/bookings";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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

function to12Hour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

interface BookingWidgetProps {
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  formFields: FormField[];
  availability: AvailabilityRules | null;
  trackingParams?: Record<string, string>;
}

type Step = "date" | "time" | "form" | "confirmed";

const STEPS: Step[] = ["date", "time", "form"];
const STEP_LABELS: Record<string, string> = { date: "Date", time: "Time", form: "Details" };

export function BookingWidget({
  slug,
  title,
  description,
  durationMinutes,
  formFields,
  availability,
  trackingParams = {},
}: BookingWidgetProps) {
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const formDefaults = useMemo(() => {
    const defaults: Record<string, string> = {};
    for (const field of formFields) {
      if (field.defaultValue) {
        defaults[field.label] = field.defaultValue;
      }
    }
    return defaults;
  }, [formFields]);

  const [formData, setFormData] = useState<Record<string, string>>(formDefaults);
  const [submitting, setSubmitting] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState<number>(5);

  const stepIndex = STEPS.indexOf(step);

  const prevDefaultsRef = useRef(formDefaults);
  useEffect(() => {
    if (prevDefaultsRef.current !== formDefaults) {
      prevDefaultsRef.current = formDefaults;
      setFormData(formDefaults);
    }
  }, [formDefaults]);

  // Build redirect URL with tracking params
  const redirectUrl = (() => {
    const base = "https://ld.xperiencewave.com/congratulations";
    const params = new URLSearchParams({ booked: "true" });
    for (const [k, v] of Object.entries(trackingParams)) {
      if (v) params.set(k, v);
    }
    return `${base}?${params.toString()}`;
  })();

  useEffect(() => {
    if (step !== "confirmed") return;
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          window.location.assign(redirectUrl);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, redirectUrl]);

  const fetchSlots = async (date: Date) => {
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
  };

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

    const missing = new Set<string>();
    for (const field of formFields) {
      if (field.required && !formData[field.label]?.trim()) {
        missing.add(field.id);
      }
    }
    if (missing.size > 0) {
      setErrors(missing);
      toast.error("Please fill in all required fields");
      const firstId = Array.from(missing)[0];
      document
        .getElementById(`field-${firstId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        trackingParams,
      }),
    });

    setSubmitting(false);
    if (result.ok) {
      setMeetLink(result.data.meet_link);
      setCountdown(5);
      setStep("confirmed");
      if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).fbq) {
        (window as unknown as Record<string, ((...args: unknown[]) => void)>).fbq("track", "Lead", {
          content_name: title,
          ...(trackingParams.utm_source && {
            utm_source: trackingParams.utm_source,
          }),
        });
      }
    } else if (
      (result as unknown as { data?: { code?: string } }).data?.code === "SLOT_TAKEN" ||
      result.error?.includes("just booked")
    ) {
      toast.error("This slot was just taken. Refreshing available times...");
      setStep("time");
      setSelectedSlot(null);
      if (selectedDate) fetchSlots(selectedDate);
    } else {
      toast.error(result.error || "Something went wrong. Please try again.");
    }
  }

  const bookingWindowDays = availability?.booking_window_days || 60;
  const maxBookingDate = addDays(new Date(), bookingWindowDays);

  function isDayDisabled(date: Date): boolean {
    if (isBefore(date, startOfDay(new Date()))) return true;
    if (date > maxBookingDate) return true;
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

  // ── Sidebar ──
  const sidebar = (
    <div className="flex flex-col gap-4 border-b border-gray-100 bg-gray-50/60 p-5 sm:gap-5 sm:p-6 md:w-[280px] md:shrink-0 md:border-b-0 md:border-r lg:w-[300px]">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <User className="size-4" />
        </div>
        <span className="text-sm font-medium text-gray-500">
          Xperience Wave
        </span>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 hidden text-sm leading-relaxed text-gray-500 md:block">
            {description}
          </p>
        )}
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:flex-col md:items-start md:gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="flex size-7 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-gray-200/60">
            <Clock className="size-3.5 text-gray-400" />
          </div>
          <span>{durationMinutes} min</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="flex size-7 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-gray-200/60">
            <Video className="size-3.5 text-gray-400" />
          </div>
          <span>Google Meet</span>
        </div>
        {availability?.timezone && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="flex size-7 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-gray-200/60">
              <Globe className="size-3.5 text-gray-400" />
            </div>
            <span>{availability.timezone.replace("_", " ")}</span>
          </div>
        )}
      </div>

      {/* Selected date/time summary */}
      {selectedDate && step !== "date" && (
        <>
          <Separator className="bg-gray-200/80" />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Your selection
            </p>
            <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200/60">
              <div className="flex items-center gap-2.5 text-sm">
                <CalendarIcon className="size-4 text-indigo-500" />
                <span className="font-medium text-gray-800">
                  {format(selectedDate, "EEE, MMM d, yyyy")}
                </span>
              </div>
              {selectedSlot && (
                <div className="mt-2 flex items-center gap-2.5 text-sm">
                  <Clock className="size-4 text-indigo-500" />
                  <span className="font-medium text-gray-800">
                    {to12Hour(selectedSlot.time)} IST
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-4xl overflow-hidden border border-gray-200 bg-white shadow-xl sm:rounded-2xl">
      <div className="flex flex-col md:flex-row md:min-h-[580px]">
        {sidebar}

        {/* Main content */}
        <div className="flex flex-1 flex-col">
          {/* Step indicator */}
          {step !== "confirmed" && (
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 sm:px-6">
              <div>
                {step !== "date" ? (
                  <button
                    onClick={() => {
                      if (step === "form") {
                        setStep("time");
                      } else {
                        // Clear selected date so user can re-click the same day
                        setSelectedDate(undefined);
                        setStep("date");
                      }
                    }}
                    className="flex items-center gap-1 text-sm font-medium text-gray-400 transition-colors hover:text-gray-600"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </button>
                ) : (
                  <div className="h-5" />
                )}
              </div>

              {/* Steps */}
              <div className="flex items-center gap-1">
                {STEPS.map((s, i) => {
                  const isComplete = stepIndex > i;
                  const isCurrent = s === step;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <div
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                          isCurrent
                            ? "bg-indigo-50 text-indigo-600"
                            : isComplete
                              ? "text-indigo-400"
                              : "text-gray-300"
                        }`}
                      >
                        <div
                          className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                            isCurrent
                              ? "bg-indigo-600 text-white shadow-sm"
                              : isComplete
                                ? "bg-indigo-100 text-indigo-600"
                                : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {isComplete ? (
                            <Check className="size-3" />
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span className="hidden sm:inline">
                          {STEP_LABELS[s]}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div
                          className={`h-px w-5 transition-colors ${
                            isComplete ? "bg-indigo-300" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {/* ── Step 1: Date ── */}
            {step === "date" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Select a Date
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Pick a day that works best for you
                  </p>
                </div>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    showOutsideDays={false}
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={isDayDisabled}
                    fromDate={new Date()}
                    toDate={maxBookingDate}
                    className="w-full rounded-xl p-2 [--cell-size:2.5rem] sm:p-4 sm:[--cell-size:3rem]"
                    classNames={{
                      root: "w-full",
                      months: "flex flex-col w-full relative",
                      month: "flex flex-col w-full gap-3 sm:gap-4",
                      month_caption:
                        "flex items-center justify-center h-10 w-full px-10 sm:h-12 sm:px-12",
                      caption_label:
                        "text-sm font-semibold select-none sm:text-base text-white",
                      weekdays: "flex w-full",
                      weekday:
                        "text-gray-400 flex-1 font-medium text-xs select-none sm:text-sm",
                      week: "flex w-full mt-0.5 sm:mt-1",
                      day: "relative flex-1 p-0 text-center text-white font-medium group/day aspect-square select-none [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
                      today:
                        "bg-indigo-500/30 text-indigo-300 font-semibold rounded-lg data-[selected=true]:rounded-none",
                      disabled: "!text-gray-600 cursor-not-allowed !font-normal",
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── Step 2: Time ── */}
            {step === "time" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Select a Time
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </p>
                </div>

                {loadingSlots ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2.5 max-w-sm">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton
                          key={i}
                          className="h-12 rounded-xl bg-gray-100"
                        />
                      ))}
                    </div>
                    <p className="text-center text-sm text-gray-400">
                      Loading available times...
                    </p>
                  </div>
                ) : slots.length === 0 ? (
                  <Card className="border-dashed border-gray-200 bg-gray-50/50 py-10 shadow-none">
                    <CardContent className="flex flex-col items-center gap-4 text-center">
                      <div className="flex size-14 items-center justify-center rounded-full bg-gray-100">
                        <CalendarIcon className="size-6 text-gray-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-gray-700">
                          No available times
                        </p>
                        <p className="text-sm text-gray-500">
                          All slots on this date are booked. Try another day.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="mt-1"
                        onClick={() => setStep("date")}
                      >
                        <ArrowLeft className="mr-1.5 size-3.5" />
                        Pick another date
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="flex flex-col gap-2.5 max-w-sm">
                      {slots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => handleSlotSelect(slot)}
                          className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 hover:shadow-md active:scale-[0.98]"
                        >
                          <Clock className="size-4 text-gray-400 transition-colors group-hover:text-indigo-400" />
                          {to12Hour(slot.time)}
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-xs text-gray-400">
                      {slots.length} time{slots.length !== 1 ? "s" : ""}{" "}
                      available
                    </p>
                  </>
                )}
              </div>
            )}

            {/* ── Step 3: Form ── */}
            {step === "form" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Enter Your Details
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Fill in your information to confirm the booking
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {renderFormFields(formFields, formData, updateField, errors)}

                  <Separator className="bg-gray-100" />

                  <Button
                    type="submit"
                    className="h-12 w-full bg-indigo-600 text-base font-semibold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-[0.99]"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        Confirm Booking
                        <ChevronRight className="ml-1 size-4" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* ── Step 4: Confirmed ── */}
            {step === "confirmed" && (
              <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
                {/* Animated success icon */}
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100" />
                  <div className="relative flex size-20 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100/50">
                    <CheckCircle2 className="size-10 text-emerald-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-gray-900">
                    You&apos;re all set!
                  </h2>
                  <p className="text-gray-500">
                    A calendar invitation has been sent to your email.
                  </p>
                </div>

                {/* Booking summary card */}
                <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="bg-gray-50 px-5 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Booking confirmed
                    </p>
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-50">
                        <CalendarIcon className="size-4 text-indigo-500" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-800">
                          {selectedDate &&
                            format(selectedDate, "EEEE, MMMM d, yyyy")}
                        </p>
                        <p className="text-xs text-gray-500">
                          {selectedSlot
                            ? to12Hour(selectedSlot.time)
                            : ""}{" "}
                          IST &middot; {durationMinutes} min
                        </p>
                      </div>
                    </div>

                    {meetLink && (
                      <>
                        <Separator className="bg-gray-100" />
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50">
                            <Video className="size-4 text-blue-500" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-800">
                              Google Meet
                            </p>
                            <a
                              href={meetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-indigo-600 underline-offset-2 hover:underline"
                            >
                              Join meeting
                            </a>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Redirect countdown */}
                <div className="w-full max-w-sm space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Redirecting in{" "}
                      <span className="font-semibold tabular-nums text-gray-700">
                        {countdown}s
                      </span>
                    </span>
                    <a
                      href={redirectUrl}
                      className="font-medium text-indigo-600 underline-offset-2 hover:underline"
                    >
                      Continue now
                    </a>
                  </div>
                  <Progress
                    value={((5 - countdown) / 5) * 100}
                    className="h-1.5 bg-gray-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-5 py-3 text-center sm:px-6">
            <p className="text-xs text-gray-400">
              Powered by{" "}
              <a
                href="https://xperiencewave.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-gray-500 transition-colors hover:text-gray-700"
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

    const isShortText =
      field.type === "text" &&
      !field.label.includes("?") &&
      field.label.length < 30;
    const nextIsShortText =
      next &&
      next.type === "text" &&
      !next.label.includes("?") &&
      next.label.length < 30;

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
  const errorClass = hasError && !value?.trim() ? "border-red-300 ring-red-100" : "border-gray-200";
  const inputBase = `h-11 rounded-lg !bg-white !text-gray-900 placeholder:!text-gray-400 shadow-sm transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 ${errorClass}`;

  return (
    <div id={id} className="space-y-1.5">
      <Label
        htmlFor={`${id}-input`}
        className="text-sm font-medium text-gray-700"
      >
        {field.label}
        {field.required && (
          <span className="ml-0.5 text-red-400">*</span>
        )}
      </Label>
      {hasError && !value?.trim() && (
        <p className="text-xs font-medium text-red-500">
          This field is required
        </p>
      )}

      {field.type === "text" && (
        <Input
          id={`${id}-input`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className={inputBase}
        />
      )}

      {field.type === "email" && (
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            id={`${id}-input`}
            type="email"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || "you@example.com"}
            required={field.required}
            className={`pl-9 ${inputBase}`}
          />
        </div>
      )}

      {field.type === "phone" && (
        <div className="flex">
          <div className="flex h-11 items-center gap-1.5 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-500 shadow-sm">
            <Phone className="size-3.5 text-gray-400" />
            +91
          </div>
          <Input
            id={`${id}-input`}
            type="tel"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder?.replace(/^\+91\s*/, "") || "98765 43210"}
            required={field.required}
            className={`rounded-l-none ${inputBase}`}
          />
        </div>
      )}

      {field.type === "textarea" && (
        <Textarea
          id={`${id}-input`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={3}
          className={`resize-none rounded-lg !bg-white !text-gray-900 placeholder:!text-gray-400 shadow-sm transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 ${errorClass}`}
        />
      )}

      {field.type === "select" && (
        <Select
          value={value}
          onValueChange={onChange}
          required={field.required}
        >
          <SelectTrigger
            id={`${id}-input`}
            className={`h-11 w-full rounded-lg !bg-white !text-gray-900 shadow-sm ${errorClass}`}
          >
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
          className="!gap-1.5"
        >
          {(field.options ?? []).map((opt) => (
            <label
              key={opt}
              htmlFor={`${id}-${opt}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.995] has-[[data-state=checked]]:border-indigo-300 has-[[data-state=checked]]:bg-indigo-50 has-[[data-state=checked]]:shadow-none"
            >
              <RadioGroupItem
                value={opt}
                id={`${id}-${opt}`}
                className="mt-0.5 !bg-white border-gray-300 data-[state=checked]:border-indigo-500"
              />
              <span className="text-sm leading-snug text-gray-700">
                {opt}
              </span>
            </label>
          ))}
        </RadioGroup>
      )}
    </div>
  );
}

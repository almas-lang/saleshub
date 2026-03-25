"use client";

import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, isSameDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PRESETS = [
  { label: "Last 7 days", getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Last 30 days", getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "Last 90 days", getValue: () => ({ from: subDays(new Date(), 89), to: new Date() }) },
  { label: "This month", getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Last month", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  {
    label: "This FY",
    getValue: () => {
      const now = new Date();
      const fyStart = now.getMonth() >= 3
        ? new Date(now.getFullYear(), 3, 1)
        : new Date(now.getFullYear() - 1, 3, 1);
      return { from: fyStart, to: now };
    },
  },
];

function matchesPreset(range: DateRange | undefined): string | null {
  if (!range?.from || !range?.to) return null;
  for (const preset of PRESETS) {
    const pv = preset.getValue();
    if (isSameDay(range.from, pv.from) && isSameDay(range.to, pv.to)) {
      return preset.label;
    }
  }
  return null;
}

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(value);

  // Sync draft when popover opens
  React.useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const activePreset = matchesPreset(draft);

  function handleApply() {
    onChange(draft);
    setOpen(false);
  }

  function handlePreset(preset: (typeof PRESETS)[number]) {
    const range = preset.getValue();
    setDraft(range);
    onChange(range);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, "dd MMM yyyy")} –{" "}
                {format(value.to, "dd MMM yyyy")}
              </>
            ) : (
              format(value.from, "dd MMM yyyy")
            )
          ) : (
            "Select date range"
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets */}
          <div className="border-r p-2 space-y-0.5 min-w-[140px]">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={activePreset === preset.label ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start text-xs",
                  activePreset === preset.label && "font-medium"
                )}
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <div>
            <Calendar
              mode="range"
              defaultMonth={draft?.from}
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={2}
            />

            {/* Footer: summary + Apply */}
            <div className="flex items-center justify-between border-t px-4 py-2">
              <p className="text-xs text-muted-foreground">
                {draft?.from ? (
                  draft.to ? (
                    <>
                      {format(draft.from, "dd MMM")} – {format(draft.to, "dd MMM yyyy")}
                    </>
                  ) : (
                    <>Pick end date</>
                  )
                ) : (
                  <>Pick start date</>
                )}
              </p>
              <Button
                size="sm"
                className="h-7 text-xs px-3"
                disabled={!draft?.from || !draft?.to}
                onClick={handleApply}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

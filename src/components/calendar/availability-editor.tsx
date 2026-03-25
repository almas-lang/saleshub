"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";
import type { AvailabilityRules, DaySchedule } from "@/types/bookings";
import { DAY_NAMES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface AvailabilityEditorProps {
  rules: AvailabilityRules;
  onChange: (rules: AvailabilityRules) => void;
}

export function AvailabilityEditor({ rules, onChange }: AvailabilityEditorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  function updateDay(index: number, partial: Partial<DaySchedule>) {
    const updated = [...rules.schedule];
    updated[index] = { ...updated[index], ...partial };
    onChange({ ...rules, schedule: updated });
  }

  function addBlockedDate(date: Date) {
    const iso = format(date, "yyyy-MM-dd");
    if (rules.blocked_dates.includes(iso)) return;
    onChange({ ...rules, blocked_dates: [...rules.blocked_dates, iso].sort() });
  }

  function removeBlockedDate(dateStr: string) {
    onChange({
      ...rules,
      blocked_dates: rules.blocked_dates.filter((d) => d !== dateStr),
    });
  }

  return (
    <div className="space-y-6">
      {/* Weekly schedule */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Weekly Schedule</Label>
        <div className="space-y-2">
          {rules.schedule.map((day, i) => (
            <div
              key={day.day}
              className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
            >
              <Switch
                checked={day.enabled}
                onCheckedChange={(enabled) => updateDay(i, { enabled })}
              />
              <span className="w-24 text-sm font-medium">
                {DAY_NAMES[day.day]}
              </span>
              {day.enabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={day.start_time}
                    onChange={(e) => updateDay(i, { start_time: e.target.value })}
                    className="h-8 w-32"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={day.end_time}
                    onChange={(e) => updateDay(i, { end_time: e.target.value })}
                    className="h-8 w-32"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Unavailable</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Buffer, max per day, booking window */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="buffer">Buffer between bookings (min)</Label>
          <Input
            id="buffer"
            type="number"
            min={0}
            max={120}
            value={rules.buffer_minutes}
            onChange={(e) =>
              onChange({ ...rules, buffer_minutes: parseInt(e.target.value) || 0 })
            }
            className="h-9 w-32"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxDay">Max bookings per day</Label>
          <Input
            id="maxDay"
            type="number"
            min={1}
            max={50}
            value={rules.max_per_day}
            onChange={(e) =>
              onChange({ ...rules, max_per_day: parseInt(e.target.value) || 1 })
            }
            className="h-9 w-32"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="windowDays">Booking window (days ahead)</Label>
          <Input
            id="windowDays"
            type="number"
            min={1}
            max={90}
            value={rules.booking_window_days ?? 60}
            onChange={(e) =>
              onChange({ ...rules, booking_window_days: parseInt(e.target.value) || 60 })
            }
            className="h-9 w-32"
          />
          <p className="text-[11px] text-muted-foreground">
            Only the next {rules.booking_window_days ?? 60} days are bookable
          </p>
        </div>
      </div>

      {/* Blocked dates */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Blocked Dates</Label>
        {rules.blocked_dates.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rules.blocked_dates.map((d) => (
              <Badge key={d} variant="secondary" className="gap-1 pr-1">
                {d}
                <button
                  type="button"
                  onClick={() => removeBlockedDate(d)}
                  className="ml-0.5 rounded-full hover:bg-destructive/20"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Add blocked date
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              onSelect={(date) => {
                if (date) {
                  addBlockedDate(date);
                  setCalendarOpen(false);
                }
              }}
              disabled={(date) => date < new Date()}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Assignment mode */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Assignment Mode</Label>
        <RadioGroup
          value={rules.assignment_mode}
          onValueChange={(v) =>
            onChange({
              ...rules,
              assignment_mode: v as "round_robin" | "specific",
            })
          }
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="round_robin" id="round_robin" />
            <Label htmlFor="round_robin" className="font-normal">
              Round Robin
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="specific" id="specific" />
            <Label htmlFor="specific" className="font-normal">
              Specific Person
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

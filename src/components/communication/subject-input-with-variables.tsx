"use client";

import { useRef, useState } from "react";
import { Braces } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const VARIABLES = [
  { label: "First Name", value: "first_name" },
  { label: "Last Name", value: "last_name" },
  { label: "Company", value: "company_name" },
  { label: "Email", value: "email" },
  { label: "Phone", value: "phone" },
  { label: "Booking Date", value: "booking_date" },
  { label: "Booking Time", value: "booking_time" },
  { label: "Google Meet Link", value: "booking_meet_link" },
  { label: "Reschedule Link", value: "booking_reschedule_link" },
  { label: "Add to Google Cal", value: "google_calendar_link" },
  { label: "Add to Apple Cal", value: "apple_calendar_link" },
] as const;

interface SubjectInputWithVariablesProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SubjectInputWithVariables({
  value,
  onChange,
  placeholder = "Email subject line...",
}: SubjectInputWithVariablesProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  function insertVariable(variable: string) {
    const input = inputRef.current;
    const tag = `{{${variable}}}`;

    if (input) {
      const start = input.selectionStart ?? value.length;
      const end = input.selectionEnd ?? value.length;
      const next = value.slice(0, start) + tag + value.slice(end);
      onChange(next);

      // Restore cursor after the inserted variable
      requestAnimationFrame(() => {
        input.focus();
        const pos = start + tag.length;
        input.setSelectionRange(pos, pos);
      });
    } else {
      onChange(value + tag);
    }

    setOpen(false);
  }

  return (
    <div className="flex gap-1.5">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            type="button"
            title="Insert variable"
            className="shrink-0"
          >
            <Braces className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end">
          <div className="flex flex-col">
            {VARIABLES.map((v) => (
              <button
                key={v.value}
                type="button"
                className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => insertVariable(v.value)}
              >
                <span className="text-muted-foreground font-mono text-xs">
                  {"{{"}
                </span>{" "}
                {v.label}{" "}
                <span className="text-muted-foreground font-mono text-xs">
                  {"}}"}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

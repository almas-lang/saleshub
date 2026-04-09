"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Braces } from "lucide-react";
import { useState } from "react";

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
  { label: "Unsubscribe Link", value: "unsubscribe_link" },
] as const;

interface EmailVariableMenuProps {
  onInsert: (variable: string) => void;
}

export function EmailVariableMenu({ onInsert }: EmailVariableMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Insert variable"
          type="button"
        >
          <Braces className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="flex flex-col">
          {VARIABLES.map((v) => (
            <button
              key={v.value}
              type="button"
              className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onInsert(v.value);
                setOpen(false);
              }}
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
  );
}

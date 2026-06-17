"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /** Max items to show as badges before collapsing to "+N more" */
  maxDisplay?: number;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  emptyText = "No results found.",
  className,
  disabled = false,
  maxDisplay = 2,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  function handleToggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
    .slice(0, maxDisplay);
  const overflow = selected.length - maxDisplay;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-9 w-full justify-between font-normal",
            selected.length === 0 && "text-muted-foreground",
            className
          )}
        >
          <div className="flex flex-wrap items-center gap-1">
            {selected.length === 0 ? (
              <span className="text-sm">{placeholder}</span>
            ) : (
              <>
                {selectedLabels.map((label) => (
                  <Badge
                    key={label}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    {label}
                  </Badge>
                ))}
                {overflow > 0 && (
                  <span className="text-xs text-muted-foreground">
                    +{overflow} more
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {selected.length > 0 && (
              <X
                className="size-3.5 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search...`} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleToggle(option.value)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {isSelected && <Check className="size-3" />}
                    </div>
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useState, useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FilterOption {
  id: string;
  name: string;
}

interface StageOption extends FilterOption {
  funnel_id: string;
}

type Filters = {
  source: string;
  funnel_id: string;
  stage_id: string;
  assigned_to: string;
  booked: string;
};

interface ProspectFiltersProps {
  sources: string[];
  funnels: FilterOption[];
  stages: StageOption[];
  teamMembers: FilterOption[];
  filters: Filters;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}

const EMPTY_FILTERS: Filters = {
  source: "",
  funnel_id: "",
  stage_id: "",
  assigned_to: "",
  booked: "",
};

export function ProspectFilters({
  sources,
  funnels,
  stages,
  teamMembers,
  filters,
  onFilterChange,
  onClearFilters,
}: ProspectFiltersProps) {
  const activeCount = Object.values(filters).filter(Boolean).length;
  const [open, setOpen] = useState(false);

  // Local draft state — only applied on "Apply"
  const [draft, setDraft] = useState<Filters>(filters);

  // Sync draft when popover opens
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraft = (key: keyof Filters, value: string) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      // Clear stage when funnel changes
      if (key === "funnel_id" && value !== prev.funnel_id) {
        next.stage_id = "";
      }
      return next;
    });
  };

  const handleApply = () => {
    // Apply all draft values
    for (const [key, value] of Object.entries(draft)) {
      if (value !== filters[key as keyof Filters]) {
        onFilterChange(key, value);
      }
    }
    setOpen(false);
  };

  const handleClear = () => {
    setDraft(EMPTY_FILTERS);
    onClearFilters();
    setOpen(false);
  };

  // Filter stages by selected funnel in draft
  const filteredStages = draft.funnel_id
    ? stages.filter((s) => s.funnel_id === draft.funnel_id)
    : [];

  const draftCount = Object.values(draft).filter(Boolean).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="size-4" />
          Filters
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Filters</h4>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Source</label>
            <Select
              value={draft.source || "all"}
              onValueChange={(v) => updateDraft("source", v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Funnel</label>
            <Select
              value={draft.funnel_id || "all"}
              onValueChange={(v) => updateDraft("funnel_id", v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Funnels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Funnels</SelectItem>
                {funnels.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Stage</label>
            <Select
              value={draft.stage_id || "all"}
              onValueChange={(v) => updateDraft("stage_id", v === "all" ? "" : v)}
              disabled={!draft.funnel_id}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {filteredStages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Assigned To</label>
            <Select
              value={draft.assigned_to || "all"}
              onValueChange={(v) => updateDraft("assigned_to", v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Call Booked</label>
            <Select
              value={draft.booked || "all"}
              onValueChange={(v) => updateDraft("booked", v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Booked</SelectItem>
                <SelectItem value="no">Not Booked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t">
            {draftCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-muted-foreground"
                onClick={handleClear}
              >
                Clear all
              </Button>
            )}
            <Button
              size="sm"
              className="flex-1"
              onClick={handleApply}
            >
              Apply filters
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

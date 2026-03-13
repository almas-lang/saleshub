"use client";

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

interface ProspectFiltersProps {
  sources: string[];
  funnels: FilterOption[];
  stages: StageOption[];
  teamMembers: FilterOption[];
  filters: {
    source: string;
    funnel_id: string;
    stage_id: string;
    assigned_to: string;
    booked: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}

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

  // Filter stages by selected funnel
  const filteredStages = filters.funnel_id
    ? stages.filter((s) => s.funnel_id === filters.funnel_id)
    : [];

  return (
    <Popover>
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
          {activeCount > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onClearFilters}
            >
              Clear all
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Source</label>
            <Select
              value={filters.source || "all"}
              onValueChange={(v) => onFilterChange("source", v === "all" ? "" : v)}
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
            <label className="text-sm font-medium">Funnel</label>
            <Select
              value={filters.funnel_id || "all"}
              onValueChange={(v) => {
                onFilterChange("funnel_id", v === "all" ? "" : v);
                if (v === "all" || v !== filters.funnel_id) {
                  onFilterChange("stage_id", "");
                }
              }}
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
            <label className="text-sm font-medium">Stage</label>
            <Select
              value={filters.stage_id || "all"}
              onValueChange={(v) => onFilterChange("stage_id", v === "all" ? "" : v)}
              disabled={!filters.funnel_id}
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
            <label className="text-sm font-medium">Assigned To</label>
            <Select
              value={filters.assigned_to || "all"}
              onValueChange={(v) => onFilterChange("assigned_to", v === "all" ? "" : v)}
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
            <label className="text-sm font-medium">Call Booked</label>
            <Select
              value={filters.booked || "all"}
              onValueChange={(v) => onFilterChange("booked", v === "all" ? "" : v)}
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

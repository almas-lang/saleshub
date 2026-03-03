"use client";

import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
  const hasFilters = Object.values(filters).some(Boolean);

  // Filter stages by selected funnel
  const filteredStages = filters.funnel_id
    ? stages.filter((s) => s.funnel_id === filters.funnel_id)
    : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filters.source || "all"}
        onValueChange={(v) => onFilterChange("source", v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Source" />
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

      <Select
        value={filters.funnel_id || "all"}
        onValueChange={(v) => {
          onFilterChange("funnel_id", v === "all" ? "" : v);
          // Clear stage when funnel changes
          if (v === "all" || v !== filters.funnel_id) {
            onFilterChange("stage_id", "");
          }
        }}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Funnel" />
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

      <Select
        value={filters.stage_id || "all"}
        onValueChange={(v) => onFilterChange("stage_id", v === "all" ? "" : v)}
        disabled={!filters.funnel_id}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Stage" />
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

      <Select
        value={filters.assigned_to || "all"}
        onValueChange={(v) => onFilterChange("assigned_to", v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Assigned To" />
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

      <Select
        value={filters.booked || "all"}
        onValueChange={(v) => onFilterChange("booked", v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Call Booked" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="yes">Booked</SelectItem>
          <SelectItem value="no">Not Booked</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="mr-1 size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}

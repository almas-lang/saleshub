"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

interface FilterOption {
  id: string;
  name: string;
}

interface StageOption extends FilterOption {
  funnel_id: string;
}

interface MobileFilterSheetProps {
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

export function MobileFilterSheet({
  sources,
  funnels,
  stages,
  teamMembers,
  filters,
  onFilterChange,
  onClearFilters,
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);

  const activeCount = Object.values(filters).filter(Boolean).length;

  const filteredStages = filters.funnel_id
    ? stages.filter((s) => s.funnel_id === filters.funnel_id)
    : [];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="size-4" />
        Filters
        {activeCount > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow down your prospect list</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4">
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

          <SheetFooter className="flex-row gap-2">
            {activeCount > 0 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onClearFilters();
                  setOpen(false);
                }}
              >
                Clear filters
              </Button>
            )}
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

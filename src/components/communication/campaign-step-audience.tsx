"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Info,
  Loader2,
  UserPlus,
  Users,
  Zap,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MultiSelect } from "@/components/ui/multi-select";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { cn } from "@/lib/utils";
import { safeFetch } from "@/lib/fetch";
import type { AudienceFilter, BookingStatusFilter, EnrollmentType } from "@/types/campaigns";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";

// ── Types ──

interface FilterOption {
  id: string;
  name: string;
}

interface StageOption extends FilterOption {
  funnel_id: string;
}

interface CampaignOption {
  id: string;
  name: string;
  type: string;
}

interface PreviewContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  created_at: string;
  stage: string | null;
  booking_status: string;
}

interface CampaignStepAudienceProps {
  filter: AudienceFilter;
  onFilterChange: (filter: AudienceFilter) => void;
  sources: string[];
  funnels: FilterOption[];
  stages: StageOption[];
  teamMembers: FilterOption[];
  audienceCount: number;
  countLoading: boolean;
  /** Channel hint for the info banner. Defaults to "whatsapp". */
  channel?: "whatsapp" | "email";
  /** Campaign type — drip campaigns show enrollment type selector. */
  campaignType?: "drip" | "one_time" | "newsletter";
  /** List of campaigns for in/not-in filters */
  campaigns?: CampaignOption[];
}

export type { CampaignOption };

const ENROLLMENT_OPTIONS: {
  value: EnrollmentType;
  label: string;
  description: string;
  icon: typeof Zap;
}[] = [
  {
    value: "new_leads",
    label: "New Leads Only",
    description: "Auto-enroll new leads as they come in",
    icon: Zap,
  },
  {
    value: "existing",
    label: "Existing Contacts",
    description: "Enroll contacts from your database right now",
    icon: Users,
  },
  {
    value: "both",
    label: "Both",
    description: "Enroll existing contacts now + auto-enroll new leads",
    icon: UserPlus,
  },
];

const BOOKING_STATUS_OPTIONS = [
  { value: "never_booked" as const, label: "Never booked" },
  { value: "confirmed" as const, label: "Booked (confirmed)" },
  { value: "completed" as const, label: "Completed" },
  { value: "no_show" as const, label: "No-show" },
  { value: "cancelled" as const, label: "Cancelled" },
];

// ── Helpers to read both old single-value and new array fields ──

function getSources(f: AudienceFilter): string[] {
  if (f.sources?.length) return f.sources;
  if (f.source) return [f.source];
  return [];
}
function getFunnelIds(f: AudienceFilter): string[] {
  if (f.funnel_ids?.length) return f.funnel_ids;
  if (f.funnel_id) return [f.funnel_id];
  return [];
}
function getStageIds(f: AudienceFilter): string[] {
  if (f.stage_ids?.length) return f.stage_ids;
  if (f.stage_id) return [f.stage_id];
  return [];
}
function getAssignedTos(f: AudienceFilter): string[] {
  if (f.assigned_tos?.length) return f.assigned_tos;
  if (f.assigned_to) return [f.assigned_to];
  return [];
}

export function CampaignStepAudience({
  filter,
  onFilterChange,
  sources,
  funnels,
  stages,
  teamMembers,
  audienceCount,
  countLoading,
  channel = "whatsapp",
  campaignType,
  campaigns = [],
}: CampaignStepAudienceProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  // Derive multi-select values from filter (backward compat)
  const selectedSources = getSources(filter);
  const selectedFunnelIds = getFunnelIds(filter);
  const selectedStageIds = getStageIds(filter);
  const selectedAssignedTos = getAssignedTos(filter);

  // Stages filtered by selected funnels
  const filteredStages =
    selectedFunnelIds.length > 0
      ? stages.filter((s) => selectedFunnelIds.includes(s.funnel_id))
      : stages;

  const isDrip = campaignType === "drip";
  const enrollmentType = filter.enrollment_type ?? "new_leads";
  const showCount = !isDrip || enrollmentType !== "new_leads";
  const showExtraEmails =
    (!isDrip || enrollmentType !== "new_leads") && channel === "email";
  const showArchived = !isDrip || enrollmentType !== "new_leads";
  const useAnyLabels = isDrip && enrollmentType === "new_leads";

  // ── Change handlers (always write new array format, clear old single fields) ──

  function updateFilter(patch: Partial<AudienceFilter>) {
    onFilterChange({ ...filter, ...patch });
  }

  function handleSourcesChange(values: string[]) {
    updateFilter({ sources: values.length > 0 ? values : undefined, source: undefined });
  }

  function handleFunnelIdsChange(values: string[]) {
    // Clear stages that no longer belong to selected funnels
    const validStageIds = (filter.stage_ids ?? []).filter((sid) =>
      stages.some((s) => s.id === sid && values.includes(s.funnel_id))
    );
    updateFilter({
      funnel_ids: values.length > 0 ? values : undefined,
      funnel_id: undefined,
      stage_ids: validStageIds.length > 0 ? validStageIds : undefined,
      stage_id: undefined,
    });
  }

  function handleStageIdsChange(values: string[]) {
    updateFilter({ stage_ids: values.length > 0 ? values : undefined, stage_id: undefined });
  }

  function handleAssignedTosChange(values: string[]) {
    updateFilter({ assigned_tos: values.length > 0 ? values : undefined, assigned_to: undefined });
  }

  function handleTagsChange(value: string) {
    const tags = value
      ? value.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined;
    updateFilter({ tags });
  }

  function handleEnrollmentChange(type: EnrollmentType) {
    updateFilter({ enrollment_type: type });
  }

  function handleDateRangeChange(range: DateRange | undefined) {
    updateFilter({
      created_after: range?.from ? range.from.toISOString().slice(0, 10) : undefined,
      created_before: range?.to ? range.to.toISOString().slice(0, 10) : undefined,
    });
  }

  function handleInCampaignsChange(values: string[]) {
    updateFilter({ in_campaigns: values.length > 0 ? values : undefined });
  }

  function handleNotInCampaignsChange(values: string[]) {
    updateFilter({ not_in_campaigns: values.length > 0 ? values : undefined });
  }

  function handleBookingStatusesChange(values: string[]) {
    updateFilter({
      booking_statuses: values.length > 0 ? (values as BookingStatusFilter[]) : undefined,
    });
  }

  // Date range value for the picker
  const dateRange: DateRange | undefined =
    filter.created_after || filter.created_before
      ? {
          from: filter.created_after ? new Date(filter.created_after) : undefined,
          to: filter.created_before ? new Date(filter.created_before) : undefined,
        }
      : undefined;

  function getInfoText() {
    if (!isDrip) {
      return channel === "email"
        ? "Email campaigns require an email address \u2014 only contacts with email addresses are counted."
        : "WhatsApp requires a phone number \u2014 only contacts with phone numbers are counted.";
    }
    switch (enrollmentType) {
      case "new_leads":
        return "New leads matching these criteria will automatically enter this sequence after activation.";
      case "existing":
        return "Matching contacts from your database will be enrolled when you activate this campaign.";
      case "both":
        return "Existing contacts will be enrolled on activation. New leads will auto-enroll going forward.";
    }
  }

  const allLabel = useAnyLabels ? "Any" : "All";
  const excludedCount = filter.excluded_contact_ids?.length ?? 0;
  const totalCount = audienceCount - excludedCount + (filter.extra_emails?.length ?? 0);

  // Count active filters for the summary
  const activeFilterCount = [
    selectedSources.length > 0,
    selectedFunnelIds.length > 0,
    selectedStageIds.length > 0,
    selectedAssignedTos.length > 0,
    (filter.tags?.length ?? 0) > 0,
    !!filter.created_after || !!filter.created_before,
    (filter.in_campaigns?.length ?? 0) > 0,
    (filter.not_in_campaigns?.length ?? 0) > 0,
    (filter.booking_statuses?.length ?? 0) > 0,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Enrollment type selector (drip only) */}
      {isDrip && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Who should enter this sequence?
          </Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {ENROLLMENT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = enrollmentType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleEnrollmentChange(opt.value)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "size-4",
                        selected ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        selected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
        <Info className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {getInfoText()}
        </p>
      </div>

      {/* Filter label context */}
      {isDrip && (
        <p className="text-xs text-muted-foreground">
          {enrollmentType === "new_leads"
            ? "Use the filters below to narrow which incoming leads qualify for this sequence."
            : "Use the filters below to select which contacts to enroll."}
        </p>
      )}

      {/* ── Core filters (multi-select) ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Source</Label>
          <MultiSelect
            options={sources.map((s) => ({ value: s, label: s }))}
            selected={selectedSources}
            onChange={handleSourcesChange}
            placeholder={`${allLabel} Sources`}
          />
        </div>

        <div className="space-y-2">
          <Label>Funnel</Label>
          <MultiSelect
            options={funnels.map((f) => ({ value: f.id, label: f.name }))}
            selected={selectedFunnelIds}
            onChange={handleFunnelIdsChange}
            placeholder={`${allLabel} Funnels`}
          />
        </div>

        <div className="space-y-2">
          <Label>Stage</Label>
          <MultiSelect
            options={filteredStages.map((s) => ({ value: s.id, label: s.name }))}
            selected={selectedStageIds}
            onChange={handleStageIdsChange}
            placeholder={`${allLabel} Stages`}
            disabled={filteredStages.length === 0}
          />
        </div>

        <div className="space-y-2">
          <Label>Assigned To</Label>
          <MultiSelect
            options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
            selected={selectedAssignedTos}
            onChange={handleAssignedTosChange}
            placeholder={`${allLabel} Members`}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags (comma-separated)</Label>
        <Input
          placeholder="e.g. vip, hot-lead"
          value={filter.tags?.join(", ") ?? ""}
          onChange={(e) => handleTagsChange(e.target.value)}
        />
      </div>

      {/* ── Advanced filters ── */}
      <div className="space-y-4 rounded-lg border p-4">
        <Label className="text-sm font-medium">Advanced Filters</Label>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Created date range */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Created Date</Label>
            <div className="flex items-center gap-2">
              <DateRangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                className="w-full"
              />
              {dateRange && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => handleDateRangeChange(undefined)}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Booking status */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Booking Status</Label>
            <MultiSelect
              options={BOOKING_STATUS_OPTIONS}
              selected={filter.booking_statuses ?? []}
              onChange={handleBookingStatusesChange}
              placeholder="Any booking status"
            />
          </div>

          {/* In campaign */}
          {campaigns.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Enrolled in Campaign
              </Label>
              <MultiSelect
                options={campaigns.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                selected={filter.in_campaigns ?? []}
                onChange={handleInCampaignsChange}
                placeholder="Any campaign"
              />
            </div>
          )}

          {/* Not in campaign */}
          {campaigns.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Not in Campaign
              </Label>
              <MultiSelect
                options={campaigns.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                selected={filter.not_in_campaigns ?? []}
                onChange={handleNotInCampaignsChange}
                placeholder="Exclude none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Additional recipients (email only, when enrollment includes existing) */}
      {showExtraEmails && (
        <ExtraEmailsField filter={filter} onFilterChange={onFilterChange} />
      )}

      {/* Include archived toggle */}
      {showArchived && (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="include-archived" className="text-sm font-medium">
              Include archived contacts
            </Label>
            <p className="text-xs text-muted-foreground">
              Archived contacts are excluded by default
            </p>
          </div>
          <Switch
            id="include-archived"
            checked={filter.include_archived ?? false}
            onCheckedChange={(checked) =>
              updateFilter({ include_archived: checked || undefined })
            }
          />
        </div>
      )}

      {/* ── Live count card with preview button ── */}
      {showCount && (
        <div className="rounded-lg border bg-muted/30 p-4">
          {countLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Counting contacts...
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-sm font-medium">
                  <span className="text-2xl font-bold tabular-nums">
                    {totalCount}
                  </span>{" "}
                  {isDrip && enrollmentType === "existing"
                    ? "contacts will be enrolled on activation"
                    : isDrip && enrollmentType === "both"
                      ? "existing contacts will be enrolled + new leads going forward"
                      : `matching contact${totalCount !== 1 ? "s" : ""}`}
                  {(filter.extra_emails?.length ?? 0) > 0 && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      ({audienceCount} from filters +{" "}
                      {filter.extra_emails!.length} additional)
                    </span>
                  )}
                </p>
                {(activeFilterCount > 0 || excludedCount > 0) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeFilterCount > 0 && (
                      <>{activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} applied</>
                    )}
                    {activeFilterCount > 0 && excludedCount > 0 && " · "}
                    {excludedCount > 0 && (
                      <>{excludedCount} contact{excludedCount !== 1 ? "s" : ""} excluded</>
                    )}
                  </p>
                )}
              </div>
              {totalCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4 shrink-0"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="mr-1.5 size-3.5" />
                  Preview List
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Contact preview sheet ── */}
      <AudiencePreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        filter={filter}
        channel={channel}
        totalCount={totalCount}
        excludedIds={filter.excluded_contact_ids ?? []}
        onExcludedChange={(ids) =>
          updateFilter({ excluded_contact_ids: ids.length > 0 ? ids : undefined })
        }
      />
    </div>
  );
}

// ── Extra emails field (email campaigns only) ──

function ExtraEmailsField({
  filter,
  onFilterChange,
}: {
  filter: AudienceFilter;
  onFilterChange: (filter: AudienceFilter) => void;
}) {
  const [raw, setRaw] = useState(filter.extra_emails?.join(", ") ?? "");

  function parseAndSync(text: string) {
    const emails = text
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onFilterChange({
      ...filter,
      extra_emails: emails.length > 0 ? emails : undefined,
    });
  }

  return (
    <div className="space-y-2">
      <Label>Additional Recipients (optional)</Label>
      <Textarea
        placeholder="Paste email addresses, one per line or comma-separated"
        rows={3}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => parseAndSync(raw)}
      />
      <p className="text-xs text-muted-foreground">
        These addresses will receive the campaign even if they don&apos;t match
        the filters above.
      </p>
    </div>
  );
}

// ── Audience preview sheet ──

function AudiencePreviewSheet({
  open,
  onOpenChange,
  filter,
  channel,
  totalCount,
  excludedIds,
  onExcludedChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: AudienceFilter;
  channel: string;
  totalCount: number;
  excludedIds: string[];
  onExcludedChange: (ids: string[]) => void;
}) {
  const [contacts, setContacts] = useState<PreviewContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("channel", channel);
    params.set("page", String(page));

    // Multi-value filters
    const s = getSources(filter);
    if (s.length > 0) params.set("sources", s.join(","));
    const fi = getFunnelIds(filter);
    if (fi.length > 0) params.set("funnel_ids", fi.join(","));
    const si = getStageIds(filter);
    if (si.length > 0) params.set("stage_ids", si.join(","));
    const at = getAssignedTos(filter);
    if (at.length > 0) params.set("assigned_tos", at.join(","));
    if (filter.tags?.length) params.set("tags", filter.tags.join(","));
    if (filter.include_archived) params.set("include_archived", "true");
    if (filter.created_after) params.set("created_after", filter.created_after);
    if (filter.created_before) params.set("created_before", filter.created_before);
    if (filter.in_campaigns?.length) params.set("in_campaigns", filter.in_campaigns.join(","));
    if (filter.not_in_campaigns?.length) params.set("not_in_campaigns", filter.not_in_campaigns.join(","));
    if (filter.booking_statuses?.length) params.set("booking_statuses", filter.booking_statuses.join(","));

    return params;
  }, [filter, channel, page]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = buildParams();
    safeFetch<{
      contacts: PreviewContact[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/api/campaigns/audience-preview?${params}`).then((result) => {
      setLoading(false);
      if (result.ok) {
        setContacts(result.data.contacts);
        setTotal(result.data.total);
      }
    });
  }, [open, page, buildParams]);

  // Reset to page 1 when sheet opens
  useEffect(() => {
    if (open) setPage(1);
  }, [open]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const excludedSet = new Set(excludedIds);
  const includedOnPage = contacts.filter((c) => !excludedSet.has(c.id)).length;
  const allOnPageIncluded = contacts.length > 0 && includedOnPage === contacts.length;

  function toggleContact(id: string) {
    if (excludedSet.has(id)) {
      onExcludedChange(excludedIds.filter((eid) => eid !== id));
    } else {
      onExcludedChange([...excludedIds, id]);
    }
  }

  function togglePageAll() {
    if (allOnPageIncluded) {
      // Exclude all on this page
      const pageIds = contacts.map((c) => c.id);
      onExcludedChange([...excludedIds, ...pageIds.filter((id) => !excludedSet.has(id))]);
    } else {
      // Include all on this page (remove from excluded)
      const pageIdSet = new Set(contacts.map((c) => c.id));
      onExcludedChange(excludedIds.filter((id) => !pageIdSet.has(id)));
    }
  }

  const bookingLabel = (status: string) => {
    switch (status) {
      case "never_booked": return "Never booked";
      case "confirmed": return "Confirmed";
      case "completed": return "Completed";
      case "no_show": return "No-show";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  const bookingColor = (status: string) => {
    switch (status) {
      case "never_booked": return "text-muted-foreground";
      case "confirmed": return "text-blue-600";
      case "completed": return "text-green-600";
      case "no_show": return "text-red-600";
      case "cancelled": return "text-orange-600";
      default: return "";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Audience Preview
            <Badge variant="secondary" className="tabular-nums">
              {total - excludedIds.length} of {total} selected
            </Badge>
          </SheetTitle>
        </SheetHeader>

        {excludedIds.length > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {excludedIds.length} contact{excludedIds.length !== 1 ? "s" : ""} excluded from this campaign
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-300"
              onClick={() => onExcludedChange([])}
            >
              Include all
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading contacts...</span>
          </div>
        ) : contacts.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No matching contacts found.
          </p>
        ) : (
          <>
            <div className="rounded-md border mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allOnPageIncluded}
                        onCheckedChange={togglePageAll}
                        aria-label="Select all on page"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => {
                    const isExcluded = excludedSet.has(c.id);
                    return (
                      <TableRow
                        key={c.id}
                        className={cn(isExcluded && "opacity-50")}
                      >
                        <TableCell>
                          <Checkbox
                            checked={!isExcluded}
                            onCheckedChange={() => toggleContact(c.id)}
                            aria-label={`${isExcluded ? "Include" : "Exclude"} ${c.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {c.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {channel === "email" ? c.email : c.phone}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.source ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.stage ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span className={cn("text-xs font-medium", bookingColor(c.booking_status))}>
                            {bookingLabel(c.booking_status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(c.created_at), "dd MMM yyyy")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between py-3">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MessageSquare,
  Phone,
  Mail,
  ArrowRightLeft,
  Calendar,
  CreditCard,
  FileText,
  Globe,
  Send,
  StickyNote,
  Linkedin,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Briefcase,
  Target,
  DollarSign,
  AlertTriangle,
  Zap,
  Bell,
  CalendarPlus,
  Check,
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  UserCheck,
  Video,
  Clock,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { cn, formatDate, timeAgo, formatPhone } from "@/lib/utils";
import type { ContactWithStage, Activity, ActivityWithUser, Task, ContactFormResponse } from "@/types/contacts";
import type { WASendWithDetails, EmailSendWithDetails } from "@/types/campaigns";
import type { InvoiceWithContact } from "@/types/invoices";
import type { BookingWithRelations } from "@/types/bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ProspectForm } from "./prospect-form";
import { AddNoteDialog } from "./add-note-dialog";
import { FollowUpDialog } from "./follow-up-dialog";
import { ActivitySummaryCard } from "./activity-summary-card";
import { TagsCard } from "./tags-card";
import { MobileFab } from "./mobile-fab";
import { SendWhatsAppDialog } from "./send-whatsapp-dialog";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { ConvertToCustomerModal } from "@/components/customers/convert-to-customer-modal";
import { ChatThread } from "@/components/whatsapp/chat-thread";

interface FunnelOption {
  id: string;
  name: string;
}

interface StageOption {
  id: string;
  name: string;
  color: string;
  funnel_id: string;
}

interface TeamMemberOption {
  id: string;
  name: string;
}

interface ActivitySummaryData {
  totalInteractions: number;
  daysInPipeline: number;
  emailOpenRate: number | null;
  lastContactDate: string | null;
}

interface ProspectDetailProps {
  prospect: ContactWithStage & { activities: ActivityWithUser[]; tasks: Task[] };
  funnels: FunnelOption[];
  stages: StageOption[];
  teamMembers: TeamMemberOption[];
  formResponses: ContactFormResponse[];
  activitySummary: ActivitySummaryData;
  waSends: WASendWithDetails[];
  emailSendRecords: EmailSendWithDetails[];
  invoices: InvoiceWithContact[];
  bookings: BookingWithRelations[];
}

const ACTIVITY_ICON_CONFIG: Record<
  string,
  { icon: typeof MessageSquare; bg: string; fg: string }
> = {
  stage_change: { icon: ArrowRightLeft, bg: "bg-primary/10", fg: "text-primary" },
  email_sent: { icon: Mail, bg: "bg-blue-50", fg: "text-blue-500" },
  email_opened: { icon: Mail, bg: "bg-blue-50", fg: "text-blue-500" },
  wa_sent: { icon: Send, bg: "bg-emerald-50", fg: "text-emerald-500" },
  wa_delivered: { icon: Send, bg: "bg-emerald-50", fg: "text-emerald-500" },
  wa_read: { icon: Send, bg: "bg-emerald-50", fg: "text-emerald-500" },
  wa_reply: { icon: MessageSquare, bg: "bg-emerald-50", fg: "text-emerald-500" },
  call: { icon: Phone, bg: "bg-amber-50", fg: "text-amber-500" },
  note: { icon: StickyNote, bg: "bg-muted", fg: "text-muted-foreground" },
  booking_created: { icon: Calendar, bg: "bg-primary/10", fg: "text-primary" },
  payment_received: { icon: CreditCard, bg: "bg-emerald-50", fg: "text-emerald-500" },
  invoice_sent: { icon: FileText, bg: "bg-primary/10", fg: "text-primary" },
  form_submitted: { icon: Globe, bg: "bg-primary/10", fg: "text-primary" },
};

const DEFAULT_ICON_CONFIG = {
  icon: MessageSquare,
  bg: "bg-muted",
  fg: "text-muted-foreground",
};

export function ProspectDetail({
  prospect,
  funnels,
  stages,
  teamMembers,
  formResponses,
  activitySummary,
  waSends,
  emailSendRecords,
  invoices,
  bookings,
}: ProspectDetailProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [sendWaOpen, setSendWaOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // Note editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const currentFunnelStages = prospect.funnel_id
    ? stages.filter((s) => s.funnel_id === prospect.funnel_id)
    : [];

  const initials = `${prospect.first_name?.[0] ?? ""}${prospect.last_name?.[0] ?? ""}`.toUpperCase();
  // Pick the most complete form response — prefer one with financial_readiness/urgency (new form)
  // over one without (old form), regardless of created_at order
  const latestFormResponse = (() => {
    if (formResponses.length === 0) return null;
    if (formResponses.length === 1) return formResponses[0];
    // Score each response by how many qualifying fields are filled
    const scored = formResponses.map((fr) => {
      let score = 0;
      if (fr.financial_readiness) score += 3; // heavily weight new-form fields
      if (fr.urgency) score += 3;
      if (fr.desired_salary) score += 2;
      if (fr.blocker) score += 2;
      if (fr.work_experience) score += 1;
      if (fr.current_role) score += 1;
      if (fr.key_challenge) score += 1;
      return { fr, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].fr;
  })();
  const noteActivities = prospect.activities.filter((a) => a.type === "note");

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  async function handleStageChange(stageId: string) {
    const result = await safeFetch(`/api/contacts/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_stage_id: stageId }),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Stage updated");
    router.refresh();
  }

  async function handleAssigneeChange(memberId: string) {
    const result = await safeFetch(`/api/contacts/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to: memberId || "" }),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Assignee updated");
    router.refresh();
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSubmittingNote(true);
    const result = await safeFetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: prospect.id,
        type: "note",
        title: "Note added",
        body: noteText.trim(),
      }),
    });
    setSubmittingNote(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Note added");
    setNoteText("");
    router.refresh();
  }

  async function handleDelete() {
    const id = prospect.id;
    const result = await safeFetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.push("/prospects");
    toast("Prospect deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          const restore = await safeFetch("/api/contacts/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "restore", contact_ids: [id] }),
          });
          if (restore.ok) {
            toast.success("Restored");
            router.push(`/prospects/${id}`);
          } else {
            toast.error(restore.error);
          }
        },
      },
      duration: 6000,
    });
  }

  async function handleArchiveToggle() {
    const action = prospect.archived_at ? "unarchive" : "archive";
    const result = await safeFetch("/api/contacts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, contact_ids: [prospect.id] }),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(action === "archive" ? "Prospect archived" : "Prospect unarchived");
    router.refresh();
  }

  async function handleEditNote(activityId: string, newBody: string) {
    const result = await safeFetch(`/api/activities/${activityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newBody }),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Note updated");
    setEditingNoteId(null);
    router.refresh();
  }

  async function handleDeleteNote(activityId: string) {
    const result = await safeFetch(`/api/activities/${activityId}`, {
      method: "DELETE",
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Note deleted");
    setDeletingNoteId(null);
    router.refresh();
  }

  const lastActivity = prospect.activities[0]?.created_at;
  const assigneeName = prospect.team_members?.name;

  return (
    <>
      {/* Back link */}
      <button
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => router.push("/prospects")}
      >
        <ArrowLeft className="size-3.5" />
        Prospects
      </button>

      {/* Identity Zone */}
      <div className="flex gap-6 items-start">
        {/* Left — Contact Card */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
              {initials}
            </div>

            <div className="min-w-0">
              {/* Name */}
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  {prospect.first_name} {prospect.last_name ?? ""}
                </h1>
                {prospect.archived_at && (
                  <Badge variant="secondary" className="text-xs">
                    <Archive className="mr-1 size-3" />
                    Archived
                  </Badge>
                )}
              </div>

              {/* Contact details */}
              <div className="mt-1 flex flex-col gap-0.5">
                {prospect.email && (
                  <div className="group flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {prospect.email}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyToClipboard(prospect.email!, "email")}
                    >
                      {copiedField === "email" ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                )}
                {prospect.phone && (
                  <div className="group flex items-center gap-2">
                    <a
                      href={`https://wa.me/${prospect.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {formatPhone(prospect.phone)}
                    </a>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() =>
                        copyToClipboard(formatPhone(prospect.phone!), "phone")
                      }
                    >
                      {copiedField === "phone" ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                )}
                {prospect.linkedin_url && (
                  <a
                    href={prospect.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    LinkedIn
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Tags row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Prospect
            </span>
            {prospect.funnels && (
              <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {prospect.funnels.name}
              </span>
            )}
            {prospect.funnel_stages && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                <span
                  className="inline-block size-1.5 rounded-full"
                  style={{ backgroundColor: prospect.funnel_stages.color }}
                />
                {prospect.funnel_stages.name}
              </span>
            )}
            {prospect.source && (
              <span className="text-xs text-muted-foreground">
                via {prospect.source}
              </span>
            )}
            {prospect.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Meta row */}
          <p className="mt-2 text-xs text-muted-foreground">
            {assigneeName ? `Assigned to ${assigneeName}` : "Unassigned"}
            {" · "}
            Created {formatDate(prospect.created_at)}
            {lastActivity && (
              <>
                {" · "}
                <span suppressHydrationWarning>Last activity {timeAgo(lastActivity)}</span>
              </>
            )}
          </p>
        </div>

        {/* Right — Quick Actions */}
        <div className="hidden lg:flex w-48 shrink-0 flex-col gap-1.5">
          {prospect.phone && (
            <a
              href={`tel:${prospect.phone}`}
              className="flex items-center gap-2.5 h-9 px-3 rounded-lg border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <Phone className="size-4" />
              Call
            </a>
          )}
          {prospect.phone && (
            <button
              className="flex items-center gap-2.5 h-9 px-3 rounded-lg border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              onClick={() => setSendWaOpen(true)}
            >
              <MessageSquare className="size-4" />
              WhatsApp
            </button>
          )}
          <button
            className="flex items-center gap-2.5 h-9 px-3 rounded-lg border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            onClick={() => setAddNoteOpen(true)}
          >
            <StickyNote className="size-4" />
            Add Note
          </button>
          <button
            className="flex items-center gap-2.5 h-9 px-3 rounded-lg border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            onClick={() => setFollowUpOpen(true)}
          >
            <Bell className="size-4" />
            Follow-up
          </button>
          <button
            className="flex items-center gap-2.5 h-9 px-3 rounded-lg border text-sm text-muted-foreground opacity-50 cursor-not-allowed"
            disabled
            title="Available in the next update"
          >
            <CalendarPlus className="size-4" />
            Schedule
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 h-9 px-3 rounded-lg border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                <MoreHorizontal className="size-4" />
                More
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {prospect.phone && (
                <DropdownMenuItem asChild>
                  <a
                    href={`https://wa.me/${prospect.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 size-4" />
                    Open in WhatsApp
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setFormOpen(true)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchiveToggle}>
                {prospect.archived_at ? (
                  <><ArchiveRestore className="mr-2 size-4" /> Unarchive</>
                ) : (
                  <><Archive className="mr-2 size-4" /> Archive</>
                )}
              </DropdownMenuItem>
              {prospect.type === "prospect" && (
                <DropdownMenuItem onClick={() => setConvertOpen(true)}>
                  <UserCheck className="mr-2 size-4" />
                  Convert to Customer
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile FAB */}
      <MobileFab
        phone={prospect.phone}
        onAddNote={() => setAddNoteOpen(true)}
        onFollowUp={() => setFollowUpOpen(true)}
        onEdit={() => setFormOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onSendWhatsApp={() => setSendWaOpen(true)}
        onArchive={handleArchiveToggle}
        isArchived={!!prospect.archived_at}
      />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="mt-2">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left — Qualifying Data */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Qualifying Data</CardTitle>
              </CardHeader>
              <CardContent>
                {latestFormResponse ? (
                  <div className="space-y-4">
                    {/* Show form email if it differs from contact email */}
                    {(() => {
                      const formEmail = (latestFormResponse as Record<string, unknown>).form_email as string | null;
                      if (formEmail && formEmail !== prospect.email) {
                        return (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Form Email</p>
                            <p className="mt-0.5 text-sm">{formEmail}</p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <FormResponseRow
                      label="Total work experience"
                      value={displayWorkExperience(latestFormResponse.work_experience)}
                    />
                    <FormResponseRow
                      label="Current role"
                      value={latestFormResponse.current_role}
                    />
                    <FormResponseRow
                      label="Key challenges"
                      value={latestFormResponse.key_challenge}
                    />
                    <FormResponseRow
                      label="Desired salary"
                      value={latestFormResponse.desired_salary}
                    />
                    <FormResponseRow
                      label="Financial readiness"
                      value={displayFinancialReadiness(latestFormResponse.financial_readiness)}
                    />
                    <FormResponseRow
                      label="Urgency"
                      value={displayUrgency(latestFormResponse.urgency)}
                    />
                    <FormResponseRow
                      label="What's stopping them"
                      value={latestFormResponse.blocker}
                    />
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No qualifying data yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Right — Pipeline & Assignment */}
            <div className="space-y-4">
              <ActivitySummaryCard
                totalInteractions={activitySummary.totalInteractions}
                daysInPipeline={activitySummary.daysInPipeline}
                emailOpenRate={activitySummary.emailOpenRate}
                lastContactDate={activitySummary.lastContactDate}
              />

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Pipeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {prospect.funnels ? (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Funnel</p>
                        <p className="text-sm font-medium">{prospect.funnels.name}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">Stage</p>
                        <Select
                          value={prospect.current_stage_id ?? ""}
                          onValueChange={handleStageChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {currentFunnelStages.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="inline-block size-1.5 rounded-full"
                                    style={{ backgroundColor: s.color }}
                                  />
                                  {s.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Not assigned to a funnel
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Assigned To</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={prospect.assigned_to ?? "none"}
                    onValueChange={(v) =>
                      handleAssigneeChange(v === "none" ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {teamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Open Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  {prospect.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No open tasks
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {prospect.tasks.map((task) => (
                        <li key={task.id} className="flex items-start gap-2">
                          <CheckCircle2
                            className={cn(
                              "mt-0.5 size-4 shrink-0",
                              task.priority === "urgent"
                                ? "text-destructive"
                                : task.priority === "high"
                                  ? "text-orange-500"
                                  : "text-muted-foreground"
                            )}
                          />
                          <div className="min-w-0">
                            <p className="text-sm">{task.title}</p>
                            {task.due_at && (
                              <p className="text-xs text-muted-foreground">
                                Due {formatDate(task.due_at)}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <TagsCard
                contactId={prospect.id}
                tags={prospect.tags ?? []}
              />

              <Card>
                <CardContent className="pt-6">
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Created</dt>
                      <dd>{formatDate(prospect.created_at)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Updated</dt>
                      <dd>{formatDate(prospect.updated_at)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-6">
          <TimelineContent
            activities={prospect.activities}
            firstName={prospect.first_name}
          />
        </TabsContent>

        {/* WhatsApp Chat Tab */}
        <TabsContent value="whatsapp" className="mt-6">
          {prospect.phone ? (
            <ChatThread contactId={prospect.id} height="480px" />
          ) : (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No phone number
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a phone number to this contact to enable WhatsApp chat.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Communication Tab */}
        <TabsContent value="communication" className="mt-6">
          <CommunicationContent
            waSends={waSends}
            emailSendRecords={emailSendRecords}
            firstName={prospect.first_name}
          />
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="mt-6">
          {bookings.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="mx-auto mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No bookings yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bookings via Calendly or the booking page will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => {
                const start = new Date(booking.starts_at);
                const end = new Date(booking.ends_at);
                const durationMins = Math.round((end.getTime() - start.getTime()) / 60000);
                const isPast = end < new Date();
                const statusConfig: Record<string, { label: string; className: string }> = {
                  confirmed:    { label: "Confirmed",    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400" },
                  completed:    { label: "Completed",    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400" },
                  cancelled:    { label: "Cancelled",    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400" },
                  no_show:      { label: "No Show",      className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400" },
                };
                const outcomeConfig: Record<string, { label: string; className: string }> = {
                  qualified:      { label: "Qualified",      className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  not_qualified:  { label: "Not Qualified",  className: "bg-red-50 text-red-700 border-red-200" },
                  needs_follow_up:{ label: "Follow Up",      className: "bg-amber-50 text-amber-700 border-amber-200" },
                  converted:      { label: "Converted",      className: "bg-blue-50 text-blue-700 border-blue-200" },
                };
                const statusCfg = statusConfig[booking.status] ?? statusConfig.confirmed;
                const outcomeCfg = booking.outcome ? outcomeConfig[booking.outcome] : null;

                return (
                  <div key={booking.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Date/time block */}
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <span className="text-[10px] font-semibold uppercase leading-none">
                            {start.toLocaleDateString("en-IN", { month: "short" })}
                          </span>
                          <span className="text-lg font-bold leading-tight">
                            {start.getDate()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {start.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              {" – "}
                              {end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              {" "}({durationMins} min)
                            </span>
                            {booking.team_members && (
                              <span className="flex items-center gap-1">
                                <User className="size-3" />
                                {(booking.team_members as { name: string }).name}
                              </span>
                            )}
                            {booking.booking_pages && (
                              <span className="text-muted-foreground/70">
                                {(booking.booking_pages as { title: string }).title}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Badges + Meet link */}
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {booking.meet_link && (
                          <a
                            href={booking.meet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Video className="size-3.5" />
                            Join Meet
                          </a>
                        )}
                        {outcomeCfg && (
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${outcomeCfg.className}`}>
                            {outcomeCfg.label}
                          </span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={`rounded-full border px-2 py-0.5 text-[11px] font-medium cursor-pointer hover:opacity-80 ${statusCfg.className}`}>
                              {statusCfg.label} ▾
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-[10px]">Status</DropdownMenuLabel>
                            {(["confirmed", "completed", "no_show", "cancelled"] as const).map((s) => (
                              <DropdownMenuItem
                                key={s}
                                disabled={booking.status === s}
                                onClick={async () => {
                                  const res = await safeFetch(`/api/bookings/${booking.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: s }),
                                  });
                                  if (res.ok) { toast.success(`Booking marked as ${s.replace("_", " ")}`); router.refresh(); }
                                  else toast.error("Failed to update");
                                }}
                              >
                                {statusConfig[s]?.label ?? s}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px]">Outcome</DropdownMenuLabel>
                            {(["qualified", "not_qualified", "needs_follow_up", "converted"] as const).map((o) => (
                              <DropdownMenuItem
                                key={o}
                                disabled={booking.outcome === o}
                                onClick={async () => {
                                  const res = await safeFetch(`/api/bookings/${booking.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ outcome: o }),
                                  });
                                  if (res.ok) { toast.success(`Outcome set to ${o.replace(/_/g, " ")}`); router.refresh(); }
                                  else toast.error("Failed to update");
                                }}
                              >
                                {outcomeConfig[o]?.label ?? o}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Invoices</h3>
              <Link href="/invoices/new">
                <Button size="sm" variant="outline">
                  <FileText className="mr-1.5 size-3.5" />
                  New Invoice
                </Button>
              </Link>
            </div>
            {invoices.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="mx-auto mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No invoices yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <a
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(inv.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <InvoiceStatusBadge status={inv.status} />
                      <span className="text-sm font-medium tabular-nums">
                        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(inv.total)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-6">
          <div className="max-w-2xl">
            {/* Add Note */}
            <div>
              <Textarea
                placeholder={`Add a note about ${prospect.first_name}...`}
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
                className="resize-y"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Cmd+Enter to save
                </span>
                <Button
                  size="sm"
                  disabled={!noteText.trim() || submittingNote}
                  onClick={handleAddNote}
                >
                  {submittingNote ? "Saving..." : "Save note"}
                </Button>
              </div>
            </div>

            {/* Notes list */}
            <div className="mt-6 flex flex-col gap-3">
              {noteActivities.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No notes yet. Add context about your conversations with{" "}
                  {prospect.first_name}.
                </p>
              ) : (
                noteActivities.map((activity) => (
                  <Card key={activity.id} className="group">
                    <CardContent className="pt-4">
                      {editingNoteId === activity.id ? (
                        <div>
                          <Textarea
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                (e.metaKey || e.ctrlKey) &&
                                e.key === "Enter"
                              ) {
                                e.preventDefault();
                                handleEditNote(activity.id, editingNoteText);
                              }
                              if (e.key === "Escape") {
                                setEditingNoteId(null);
                              }
                            }}
                            rows={3}
                            className="resize-y"
                            autoFocus
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingNoteId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                handleEditNote(activity.id, editingNoteText)
                              }
                              disabled={!editingNoteText.trim()}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-sm">
                            {activity.body}
                          </p>
                          <div className="mt-3 flex items-center justify-between border-t pt-3">
                            <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                              {timeAgo(activity.created_at)}
                            </span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  setEditingNoteId(activity.id);
                                  setEditingNoteText(activity.body ?? "");
                                }}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={() => setDeletingNoteId(activity.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete prospect?"
        description="This prospect will be removed from your list. This action can be undone by an admin."
        onConfirm={handleDelete}
        destructive
      />

      <ProspectForm
        open={formOpen}
        onOpenChange={setFormOpen}
        prospect={prospect}
        funnels={funnels}
        stages={stages}
        teamMembers={teamMembers}
      />

      <AddNoteDialog
        open={addNoteOpen}
        onOpenChange={setAddNoteOpen}
        contactId={prospect.id}
        contactFirstName={prospect.first_name}
      />

      <FollowUpDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        contactId={prospect.id}
        contactFirstName={prospect.first_name}
      />

      {prospect.phone && (
        <SendWhatsAppDialog
          open={sendWaOpen}
          onOpenChange={setSendWaOpen}
          contactId={prospect.id}
          contactFirstName={prospect.first_name}
          contactPhone={formatPhone(prospect.phone)}
        />
      )}

      <ConfirmDialog
        open={!!deletingNoteId}
        onOpenChange={(open) => !open && setDeletingNoteId(null)}
        title="Delete note?"
        description="This note will be permanently removed."
        onConfirm={() => deletingNoteId && handleDeleteNote(deletingNoteId)}
        destructive
      />

      <ConvertToCustomerModal
        open={convertOpen}
        onOpenChange={setConvertOpen}
        contactId={prospect.id}
        contactName={`${prospect.first_name} ${prospect.last_name ?? ""}`.trim()}
        teamMembers={teamMembers}
      />
    </>
  );
}

const TIMELINE_PAGE_SIZE = 20;

function TimelineContent({
  activities,
  firstName,
}: {
  activities: ActivityWithUser[];
  firstName: string;
}) {
  const [visibleCount, setVisibleCount] = useState(TIMELINE_PAGE_SIZE);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const visible = activities.slice(0, visibleCount);
  const hasMore = visibleCount < activities.length;

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (activities.length === 0) {
    return (
      <div className="max-w-2xl py-12 text-center">
        <MessageSquare className="mx-auto mb-3 size-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          No activity yet with {firstName}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Make the first move — call, message, or add a note.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />

        <div className="flex flex-col">
          {visible.map((activity) => {
            const config =
              ACTIVITY_ICON_CONFIG[activity.type] ?? DEFAULT_ICON_CONFIG;
            const Icon = config.icon;
            const isExpanded = expandedIds.has(activity.id);
            const hasLongBody =
              activity.body && activity.body.length > 200;
            const userName = (activity as ActivityWithUser).team_members?.name;

            return (
              <div key={activity.id} className="relative flex gap-4 pb-6">
                <div
                  className={cn(
                    "z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                    config.bg
                  )}
                >
                  <Icon className={cn("size-3.5", config.fg)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{activity.title}</span>
                  </p>
                  {activity.body && (
                    <div className="relative mt-1">
                      <p
                        className={cn(
                          "whitespace-pre-wrap text-sm text-muted-foreground transition-all duration-200",
                          !isExpanded && hasLongBody && "max-h-[4.5em] overflow-hidden"
                        )}
                      >
                        {activity.body}
                      </p>
                      {hasLongBody && !isExpanded && (
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent" />
                      )}
                      {hasLongBody && (
                        <button
                          className="mt-0.5 text-xs font-medium text-primary hover:underline"
                          onClick={() => toggleExpand(activity.id)}
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground/70" suppressHydrationWarning>
                    {timeAgo(activity.created_at)}
                    {userName && (
                      <span> by {userName}</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasMore && (
        <div className="mt-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisibleCount((c) => c + TIMELINE_PAGE_SIZE)}
          >
            Load more ({activities.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}

function FormResponseRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}

function displayWorkExperience(val: string | null | undefined): string | null {
  if (!val) return null;
  const map: Record<string, string> = {
    fresher: "Fresher",
    "<2_years": "< 2 years",
    "3-5_years": "3-5 years",
    "5-10_years": "5-10 years",
    "10+_years": "10+ years",
  };
  return map[val] ?? val;
}

function displayFinancialReadiness(val: string | null | undefined): string | null {
  if (!val) return null;
  const map: Record<string, string> = {
    ready: "I'm ready to invest in my career and have the financial resources to make it happen.",
    careful_but_open: "I'm managing my finances carefully, but I can prioritize funding for my career if it helps me achieve my goals.",
    not_ready: "My financial situation is tight, and I'm not in a position to invest right now.",
  };
  return map[val] ?? val;
}

function displayUrgency(val: string | null | undefined): string | null {
  if (!val) return null;
  const map: Record<string, string> = {
    right_now: "Right now: Let's get started - I'm all in!",
    within_90_days: "Within 90 days: I need a little time to prepare first.",
    more_than_90_days: "More than 90 days: It's on my list, but not urgent.",
  };
  return map[val] ?? val;
}

// ── Communication Tab Components ──

type ChannelFilter = "all" | "whatsapp" | "email";

type UnifiedMessage =
  | { channel: "whatsapp"; data: WASendWithDetails }
  | { channel: "email"; data: EmailSendWithDetails };

const COMM_PAGE_SIZE = 20;

function CommunicationContent({
  waSends,
  emailSendRecords,
  firstName,
}: {
  waSends: WASendWithDetails[];
  emailSendRecords: EmailSendWithDetails[];
  firstName: string;
}) {
  const [filter, setFilter] = useState<ChannelFilter>("all");
  const [visibleCount, setVisibleCount] = useState(COMM_PAGE_SIZE);

  // Merge and sort by created_at desc
  const allMessages: UnifiedMessage[] = [
    ...waSends.map((s) => ({ channel: "whatsapp" as const, data: s })),
    ...emailSendRecords.map((s) => ({ channel: "email" as const, data: s })),
  ].sort(
    (a, b) =>
      new Date(b.data.created_at).getTime() -
      new Date(a.data.created_at).getTime()
  );

  const filtered =
    filter === "all"
      ? allMessages
      : allMessages.filter((m) => m.channel === filter);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  if (allMessages.length === 0) {
    return (
      <div className="max-w-2xl py-12 text-center">
        <Send className="mx-auto mb-3 size-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          No messages sent to {firstName} yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Send a WhatsApp message or email to get started.
        </p>
      </div>
    );
  }

  const waCount = waSends.length;
  const emailCount = emailSendRecords.length;

  return (
    <div className="max-w-2xl">
      {/* Filter buttons */}
      <div className="flex gap-2 mb-4">
        {(
          [
            { key: "all", label: "All", count: allMessages.length },
            { key: "whatsapp", label: "WhatsApp", count: waCount },
            { key: "email", label: "Email", count: emailCount },
          ] as const
        ).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => {
              setFilter(key);
              setVisibleCount(COMM_PAGE_SIZE);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {label}
            <span
              className={cn(
                "text-xs",
                filter === key
                  ? "text-primary-foreground/70"
                  : "text-muted-foreground/70"
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Message list */}
      <div className="flex flex-col gap-2">
        {visible.map((msg) => (
          <CommunicationRow key={msg.data.id} message={msg} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisibleCount((c) => c + COMM_PAGE_SIZE)}
          >
            Load more ({filtered.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}

function CommunicationRow({ message }: { message: UnifiedMessage }) {
  const { channel, data } = message;

  let label: string;
  let campaignName: string | null = null;

  if (channel === "whatsapp") {
    const wa = data as WASendWithDetails;
    label = wa.wa_steps?.wa_template_name ?? "WhatsApp Message";
    campaignName = wa.wa_campaigns?.name ?? null;
  } else {
    const email = data as EmailSendWithDetails;
    label = email.email_steps?.subject ?? "Email";
    campaignName = email.email_campaigns?.name ?? null;
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        {/* Channel icon */}
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            channel === "whatsapp" ? "bg-emerald-50" : "bg-blue-50"
          )}
        >
          {channel === "whatsapp" ? (
            <MessageSquare className="size-3.5 text-emerald-500" />
          ) : (
            <Mail className="size-3.5 text-blue-500" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {campaignName && (
              <span className="truncate text-xs text-muted-foreground">
                {campaignName}
              </span>
            )}
            <span className="text-xs text-muted-foreground/70" suppressHydrationWarning>
              {timeAgo(data.created_at)}
            </span>
          </div>
        </div>

        {/* Status */}
        <StatusBadge channel={channel} status={data.status} />
      </CardContent>
    </Card>
  );
}

const WA_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon?: string }> = {
  queued: { label: "Queued", variant: "secondary" },
  sent: { label: "Sent \u2713", variant: "outline" },
  delivered: { label: "Delivered \u2713\u2713", variant: "outline" },
  read: { label: "Read \u2713\u2713", variant: "default" },
  failed: { label: "Failed \u2717", variant: "destructive" },
};

const EMAIL_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "Queued", variant: "secondary" },
  sent: { label: "Sent", variant: "outline" },
  delivered: { label: "Delivered", variant: "outline" },
  opened: { label: "Opened", variant: "default" },
  clicked: { label: "Clicked", variant: "default" },
  bounced: { label: "Bounced", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
};

function StatusBadge({
  channel,
  status,
}: {
  channel: "whatsapp" | "email";
  status: string;
}) {
  const config =
    channel === "whatsapp"
      ? WA_STATUS_CONFIG[status] ?? { label: status, variant: "secondary" as const }
      : EMAIL_STATUS_CONFIG[status] ?? { label: status, variant: "secondary" as const };

  return (
    <Badge variant={config.variant} className="shrink-0 text-xs">
      {config.label}
    </Badge>
  );
}

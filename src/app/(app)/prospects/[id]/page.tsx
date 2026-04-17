import { notFound } from "next/navigation";
import { differenceInDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { ProspectDetail } from "@/components/prospects/prospect-detail";
import { SetBreadcrumb } from "@/components/layout/breadcrumb-context";
import type { ContactWithStage, ActivityWithUser, Task, ContactFormResponse } from "@/types/contacts";
import type { WASendWithDetails, EmailSendWithDetails } from "@/types/campaigns";
import type { InvoiceWithContact } from "@/types/invoices";
import type { BookingWithRelations } from "@/types/bookings";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch all data in parallel
  const [contactResult, activitiesResult, tasksResult, funnelsResult, membersResult, formResponsesResult, emailSendsResult, waSendsResult, emailSendRecordsResult, invoicesResult, bookingsResult] =
    await Promise.all([
      supabase
        .from("contacts")
        .select(
          "*, funnel_stages(id, name, color), funnels(id, name), team_members(id, name)"
        )
        .eq("id", id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("activities")
        .select("*, team_members(name)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("tasks")
        .select("*")
        .eq("contact_id", id)
        .in("status", ["pending", "overdue"])
        .order("due_at", { ascending: true }),
      supabase
        .from("funnels")
        .select("id, name, funnel_stages(id, name, color, funnel_id)")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("team_members")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("contact_form_responses")
        .select("*")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
      // Email sends + opens for open rate
      supabase
        .from("activities")
        .select("type")
        .eq("contact_id", id)
        .in("type", ["email_sent", "email_opened"]),
      // WhatsApp sends with campaign/step joins
      supabase
        .from("wa_sends")
        .select("*, wa_campaigns(name), wa_steps(wa_template_name)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      // Email sends with campaign/step joins
      supabase
        .from("email_sends")
        .select("*, email_campaigns(name), email_steps(subject)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      // Invoices for this contact
      supabase
        .from("invoices")
        .select("*, contacts(id, first_name, last_name, email, phone, company_name)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      // Bookings for this contact
      supabase
        .from("bookings")
        .select("*, team_members(id, name), booking_pages(id, title, slug)")
        .eq("contact_id", id)
        .order("starts_at", { ascending: false }),
    ]);

  if (contactResult.error || !contactResult.data) {
    notFound();
  }

  const prospect = {
    ...contactResult.data,
    activities: (activitiesResult.data ?? []) as ActivityWithUser[],
    tasks: (tasksResult.data ?? []) as Task[],
  } as ContactWithStage & { activities: ActivityWithUser[]; tasks: Task[] };

  // Look up the form-field order from the booking page the prospect came from,
  // so Qualifying Data renders in the same order as the form config.
  const bookingPageSlug =
    (contactResult.data.metadata as Record<string, unknown> | null)?.booking_page as
      | string
      | undefined;
  let formFieldOrder: string[] = [];
  if (bookingPageSlug) {
    const { data: pageData } = await supabase
      .from("booking_pages")
      .select("form_fields")
      .eq("slug", bookingPageSlug)
      .maybeSingle();
    const fields = (pageData?.form_fields ?? []) as { label?: string }[];
    formFieldOrder = fields.map((f) => f.label ?? "").filter(Boolean);
  }

  const funnelList = (funnelsResult.data ?? []).map((f) => ({ id: f.id, name: f.name }));

  const stageList = (funnelsResult.data ?? []).flatMap((f) =>
    (
      (f.funnel_stages ?? []) as {
        id: string;
        name: string;
        color: string;
        funnel_id: string;
      }[]
    ).map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      funnel_id: s.funnel_id,
    }))
  );

  const teamMemberList = (membersResult.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
  }));

  const formResponses = (formResponsesResult.data ?? []) as ContactFormResponse[];

  // Compute activity summary stats
  const allActivities = activitiesResult.data ?? [];
  const totalInteractions = allActivities.length;
  const daysInPipeline = differenceInDays(
    new Date(),
    new Date(contactResult.data.created_at)
  );
  const emailSends = (emailSendsResult.data ?? []);
  const emailSentCount = emailSends.filter((e) => e.type === "email_sent").length;
  const emailOpenedCount = emailSends.filter((e) => e.type === "email_opened").length;
  const emailOpenRate =
    emailSentCount > 0 ? Math.round((emailOpenedCount / emailSentCount) * 100) : null;
  const lastContactDate = allActivities.length > 0 ? allActivities[0].created_at : null;

  const prospectName = `${prospect.first_name} ${prospect.last_name ?? ""}`.trim();

  return (
    <div className="space-y-6">
      <SetBreadcrumb
        items={[
          { label: "Prospects", href: "/prospects" },
          { label: prospectName },
        ]}
      />
      <ProspectDetail
        prospect={prospect}
        funnels={funnelList}
        stages={stageList}
        teamMembers={teamMemberList}
        formResponses={formResponses}
        formFieldOrder={formFieldOrder}
        activitySummary={{
          totalInteractions,
          daysInPipeline,
          emailOpenRate,
          lastContactDate,
        }}
        waSends={(waSendsResult.data ?? []) as WASendWithDetails[]}
        emailSendRecords={(emailSendRecordsResult.data ?? []) as EmailSendWithDetails[]}
        invoices={(invoicesResult.data ?? []) as InvoiceWithContact[]}
        bookings={(bookingsResult.data ?? []) as BookingWithRelations[]}
      />
    </div>
  );
}

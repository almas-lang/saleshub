import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingPageBuilder } from "@/components/calendar/booking-page-builder";
import { SetBreadcrumb } from "@/components/layout/breadcrumb-context";
import type { BookingPageWithCount, TeamMember } from "@/types/bookings";

export default async function BookingPageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data, error }, { data: members }] = await Promise.all([
    supabase
      .from("booking_pages")
      .select("*, bookings(count)")
      .eq("id", id)
      .single(),
    supabase
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (error || !data) {
    notFound();
  }

  const page: BookingPageWithCount = {
    ...data,
    booking_count: (data.bookings as unknown as { count: number }[])?.[0]?.count ?? 0,
  };

  return (
    <>
      <SetBreadcrumb
        items={[
          { label: "Booking Pages", href: "/calendar" },
          { label: data.title },
        ]}
      />
      <BookingPageBuilder
        page={page}
        teamMembers={(members ?? []) as TeamMember[]}
      />
    </>
  );
}

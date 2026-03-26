import { createClient } from "@/lib/supabase/server";
import { BookingPageList } from "@/components/calendar/booking-page-list";
import { BookingsSection } from "@/components/calendar/bookings-section";
import { StatCard } from "@/components/shared/stat-card";
import type { BookingWithRelations } from "@/types/bookings";

export default async function CalendarPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [{ data }, { data: upcomingData }, { data: pastData }, { count: totalBookings }, { count: completedBookings }] = await Promise.all([
    supabase
      .from("booking_pages")
      .select("*, bookings(count)")
      .order("created_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("*, contacts(id, first_name, last_name, email, phone), team_members(id, name), booking_pages(id, title, slug)")
      .gte("starts_at", now)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true })
      .limit(25),
    supabase
      .from("bookings")
      .select("*, contacts(id, first_name, last_name, email, phone), team_members(id, name), booking_pages(id, title, slug)")
      .lt("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(25),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .neq("status", "cancelled"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
  ]);

  const pages = (data ?? []).map((p) => ({
    ...p,
    booking_count: (p.bookings as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  const upcoming = (upcomingData ?? []) as unknown as BookingWithRelations[];
  const past = (pastData ?? []) as unknown as BookingWithRelations[];

  const total = totalBookings ?? 0;
  const completed = completedBookings ?? 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage booking pages and view upcoming bookings.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Booking Pages" value={pages.length} format="number" color="blue" index={0} />
        <StatCard label="Upcoming" value={upcoming.length} format="number" color="emerald" index={1} />
        <StatCard label="Completion Rate" value={completionRate} format="percent" color="amber" index={2} />
      </div>

      <BookingPageList pages={pages} />
      <BookingsSection upcoming={upcoming} past={past} />
    </div>
  );
}

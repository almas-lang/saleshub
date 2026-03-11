import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { FormField, AvailabilityRules } from "@/types/bookings";
import { BookingWidget } from "@/components/booking/booking-widget";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await supabaseAdmin
    .from("booking_pages")
    .select("title, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return { title: "Book a Call" };

  return {
    title: `${data.title} | Xperience Wave`,
    description: data.description ?? "Schedule a call with us.",
  };
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: page, error } = await supabaseAdmin
    .from("booking_pages")
    .select("id, title, slug, description, duration_minutes, form_fields, availability_rules, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !page) {
    notFound();
  }

  const formFields = (page.form_fields as unknown as FormField[]) ?? [];
  const availability = (page.availability_rules as unknown as AvailabilityRules) ?? null;

  return (
    <div className="flex min-h-svh items-start justify-center bg-muted/30 px-0 py-0 sm:px-4 sm:py-8 md:items-center md:py-12">
      <BookingWidget
        slug={page.slug}
        title={page.title}
        description={page.description}
        durationMinutes={page.duration_minutes}
        formFields={formFields}
        availability={availability}
      />
    </div>
  );
}

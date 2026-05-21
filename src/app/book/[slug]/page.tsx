import Script from "next/script";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { FormField, FormSection, AvailabilityRules } from "@/types/bookings";
import { BookingWidget } from "@/components/booking/booking-widget";

// Same GA4 measurement ID as the marketing site, so booking-flow events chain
// onto the existing funnel. Loaded only on this public route — never on the CRM app.
const GA4_ID = "G-26R787N9N5";

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const queryParams = await searchParams;

  const { data: page, error } = await supabaseAdmin
    .from("booking_pages")
    .select("id, title, slug, description, duration_minutes, form_fields, form_sections, availability_rules, redirect_url, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !page) {
    notFound();
  }

  const formFields = (page.form_fields as unknown as FormField[]) ?? [];
  const formSections = (page.form_sections as unknown as FormSection[]) ?? [];
  const availability = (page.availability_rules as unknown as AvailabilityRules) ?? null;

  // Extract tracking params to pass through the booking flow
  const trackingParams: Record<string, string> = {};
  const TRACKING_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "lead_id", "fbclid", "gclid"];
  for (const key of TRACKING_KEYS) {
    if (queryParams[key]) trackingParams[key] = queryParams[key]!;
  }

  return (
    <div className="flex min-h-svh items-start justify-center bg-gradient-to-b from-gray-50 to-gray-100/80 px-0 py-0 sm:px-4 sm:py-8 md:items-center md:py-12">
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`} strategy="afterInteractive" />
      <Script id="ga4-book" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA4_ID}');
      `}</Script>
      <BookingWidget
        slug={page.slug}
        title={page.title}
        description={page.description}
        durationMinutes={page.duration_minutes}
        formFields={formFields}
        formSections={formSections}
        availability={availability}
        trackingParams={trackingParams}
        redirectUrl={page.redirect_url}
      />
    </div>
  );
}

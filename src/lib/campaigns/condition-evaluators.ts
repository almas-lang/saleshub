import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Evaluate a drip step condition for a given contact.
 * Returns true if the condition is met.
 */
export async function evaluateCondition(
  check: string,
  contactId: string,
  campaignId: string
): Promise<boolean> {
  switch (check) {
    case "booking_created": {
      const { count } = await supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contactId);
      return (count ?? 0) > 0;
    }

    case "replied": {
      const { count } = await supabaseAdmin
        .from("wa_sends")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contactId)
        .eq("campaign_id", campaignId)
        .eq("replied", true);
      return (count ?? 0) > 0;
    }

    default:
      return false;
  }
}

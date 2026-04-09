import type { AdSpend } from "@/types/finance";
import type { Json } from "@/lib/supabase/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  impressions: string;
  reach: string;
  clicks: string;
  spend: string;
  actions?: { action_type: string; value: string }[];
  date_start: string;
  date_stop: string;
}

/**
 * Fetch ad spend from Meta Ads API for a given date range.
 * Requires META_ADS_ACCESS_TOKEN and META_AD_ACCOUNT_ID env vars.
 */
export async function fetchMetaAdSpend(
  from: string,
  to: string
): Promise<Omit<AdSpend, "id" | "created_at" | "updated_at">[]> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !accountId) {
    throw new Error("Meta Ads credentials not configured");
  }

  const params = new URLSearchParams({
    access_token: token,
    fields: "campaign_id,campaign_name,impressions,reach,clicks,spend,actions",
    time_range: JSON.stringify({ since: from, until: to }),
    level: "campaign",
    time_increment: "1", // daily
  });

  const res = await fetch(
    `${META_BASE}/act_${accountId}/insights?${params.toString()}`
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API error: ${res.status} — ${body}`);
  }

  const json = await res.json();
  const data = (json.data ?? []) as MetaInsightRow[];

  return data.map((row) => {
    const leads =
      row.actions?.find((a) => a.action_type === "lead")?.value ?? "0";

    return {
      platform: "meta" as const,
      campaign_name: row.campaign_name,
      campaign_id: row.campaign_id,
      date: row.date_start,
      amount: parseFloat(row.spend) || 0,
      impressions: parseInt(row.impressions) || 0,
      reach: parseInt(row.reach) || 0,
      clicks: parseInt(row.clicks) || 0,
      leads: parseInt(leads) || 0,
      spend_currency: "INR",
      metadata: null,
    };
  });
}

/**
 * Fetch and sync Meta ad spend data into the ad_spend table.
 * Deletes existing Meta rows in the date range first, then inserts fresh data.
 */
export async function syncMetaAdsToDb(
  from: string,
  to: string
): Promise<{ inserted: number; replaced: number }> {
  const rows = await fetchMetaAdSpend(from, to);

  // Delete existing Meta rows in this date range to avoid duplicates
  const { count } = await supabaseAdmin
    .from("ad_spend")
    .delete({ count: "exact" })
    .eq("platform", "meta")
    .gte("date", from)
    .lte("date", to);

  const replaced = count ?? 0;

  if (rows.length === 0) return { inserted: 0, replaced };

  const { error } = await supabaseAdmin.from("ad_spend").insert(
    rows.map((r) => ({
      platform: r.platform,
      campaign_name: r.campaign_name,
      campaign_id: r.campaign_id,
      date: r.date,
      amount: r.amount,
      impressions: r.impressions,
      reach: r.reach,
      clicks: r.clicks,
      leads: r.leads,
      spend_currency: r.spend_currency,
      metadata: r.metadata as unknown as Json | null,
    }))
  );

  if (error) throw new Error(`Insert failed: ${error.message}`);

  return { inserted: rows.length, replaced };
}

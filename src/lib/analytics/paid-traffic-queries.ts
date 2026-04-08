import { supabaseAdmin } from "@/lib/supabase/admin";
import { eachDayOfInterval, parseISO, format } from "date-fns";
import type { PaidTrafficDayRow } from "@/types/paid-traffic";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** UTM sources that map to each ad platform */
const PLATFORM_UTM_MAP: Record<string, string[]> = {
  meta: ["facebook", "fb", "ig", "instagram", "meta"],
  google: ["google", "gads", "google_ads"],
  linkedin: ["linkedin", "li"],
};

function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Fetch combined paid traffic data for a date range.
 * Joins Meta ad_spend with SalesHub contacts/bookings/invoices.
 */
export async function getPaidTrafficData(
  from: string,
  to: string,
  platform: string = "meta"
): Promise<PaidTrafficDayRow[]> {
  const utmSources = PLATFORM_UTM_MAP[platform] ?? [platform];

  // End of day for timestamp queries
  const fromTs = `${from}T00:00:00+05:30`;
  const toTs = `${to}T23:59:59+05:30`;

  const [adSpendRes, leadsRes, bookingsRes, callsRes, invoicesRes, installmentsRes, conversionsRes] =
    await Promise.all([
      // 1. Ad spend — grouped by date (reach column added via migration)
      supabaseAdmin
        .from("ad_spend")
        .select("date, amount, impressions, clicks, reach" as any)
        .eq("platform", platform)
        .gte("date", from)
        .lte("date", to) as any,

      // 2. Leads — contacts created in range with matching UTM
      supabaseAdmin
        .from("contacts")
        .select("id, created_at")
        .eq("type", "prospect")
        .in("utm_source", utmSources)
        .gte("created_at", fromTs)
        .lte("created_at", toTs)
        .is("deleted_at", null),

      // 3. Bookings (apps) created in range
      supabaseAdmin
        .from("bookings")
        .select("id, created_at")
        .gte("created_at", fromTs)
        .lte("created_at", toTs),

      // 4. Completed calls — bookings with status=completed
      supabaseAdmin
        .from("bookings")
        .select("id, starts_at")
        .eq("status", "completed")
        .gte("starts_at", fromTs)
        .lte("starts_at", toTs),

      // 5. Invoices paid (non-installment) — revenue
      supabaseAdmin
        .from("invoices")
        .select("total, paid_at")
        .eq("status", "paid")
        .eq("has_installments", false)
        .gte("paid_at", fromTs)
        .lte("paid_at", toTs),

      // 6. Installments paid — cash
      supabaseAdmin
        .from("installments")
        .select("amount, paid_at")
        .eq("status", "paid")
        .gte("paid_at", fromTs)
        .lte("paid_at", toTs),

      // 7. Conversions — contacts that became customers
      supabaseAdmin
        .from("contacts")
        .select("id, converted_at")
        .eq("type", "customer")
        .gte("converted_at", fromTs)
        .lte("converted_at", toTs)
        .is("deleted_at", null),
    ]);

  // Build per-day maps
  const adMap = new Map<string, { spend: number; impressions: number; reach: number; clicks: number }>();
  const adRows = (adSpendRes?.data ?? []) as { date: string; amount: number; impressions: number; reach: number; clicks: number }[];
  for (const row of adRows) {
    const existing = adMap.get(row.date);
    if (existing) {
      existing.spend += row.amount;
      existing.impressions += row.impressions;
      existing.reach += (row.reach ?? 0);
      existing.clicks += row.clicks;
    } else {
      adMap.set(row.date, {
        spend: row.amount,
        impressions: row.impressions,
        reach: row.reach ?? 0,
        clicks: row.clicks,
      });
    }
  }

  function countByDate(rows: any[], dateField: string): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of rows) {
      const d = format(new Date(row[dateField]), "yyyy-MM-dd");
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }

  function sumByDate(rows: any[], dateField: string, amountField: string): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of rows) {
      const d = format(new Date(row[dateField]), "yyyy-MM-dd");
      map.set(d, (map.get(d) ?? 0) + (row[amountField] ?? 0));
    }
    return map;
  }

  const leadsMap = countByDate(leadsRes.data ?? [], "created_at");
  const bookingsMap = countByDate(bookingsRes.data ?? [], "created_at");
  const callsMap = countByDate(callsRes.data ?? [], "starts_at");
  const conversionsMap = countByDate(conversionsRes.data ?? [], "converted_at");
  const invoiceRevenueMap = sumByDate(invoicesRes.data ?? [], "paid_at", "total");
  const installmentCashMap = sumByDate(installmentsRes.data ?? [], "paid_at", "amount");

  // Fetch overrides
  const { data: overrideRows } = await supabaseAdmin
    .from("paid_traffic_overrides" as any)
    .select("date, field, override_value")
    .eq("platform", platform)
    .gte("date", from)
    .lte("date", to) as any;

  const overrideMap = new Map<string, number>(); // key: "YYYY-MM-DD:field"
  for (const row of (overrideRows ?? []) as { date: string; field: string; override_value: number }[]) {
    overrideMap.set(`${row.date}:${row.field}`, row.override_value);
  }

  function getVal(dateStr: string, field: string, computed: number): number {
    return overrideMap.get(`${dateStr}:${field}`) ?? computed;
  }

  // Generate a row for each day in range
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });

  return days.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const ad = adMap.get(dateStr) ?? { spend: 0, impressions: 0, reach: 0, clicks: 0 };
    // Apply overrides — user corrections take precedence over computed values
    const adSpend = getVal(dateStr, "adSpend", ad.spend);
    const impressions = getVal(dateStr, "impressions", ad.impressions);
    const reach = getVal(dateStr, "reach", ad.reach);
    const clicks = getVal(dateStr, "clicks", ad.clicks);
    const leads = getVal(dateStr, "leads", leadsMap.get(dateStr) ?? 0);
    const apps = getVal(dateStr, "apps", bookingsMap.get(dateStr) ?? 0);
    const calls = getVal(dateStr, "calls", callsMap.get(dateStr) ?? 0);
    const sales = getVal(dateStr, "sales", conversionsMap.get(dateStr) ?? 0);
    const invoiceRevenue = invoiceRevenueMap.get(dateStr) ?? 0;
    const installmentCash = installmentCashMap.get(dateStr) ?? 0;
    const revenue = getVal(dateStr, "revenue", invoiceRevenue + installmentCash);
    const cash = getVal(dateStr, "cash", invoiceRevenue + installmentCash);

    return {
      date: dateStr,
      // Layer 1
      adSpend,
      impressions,
      reach,
      cpm: safeDivide(adSpend, impressions) * 1000,
      clicks,
      ctr: safeDivide(clicks, reach) * 100,
      cpc: safeDivide(adSpend, clicks),
      // Layer 2
      leads,
      leadCost: safeDivide(adSpend, leads),
      lpCr: safeDivide(leads, clicks) * 100,
      apps,
      appCost: safeDivide(adSpend, apps),
      appPercent: safeDivide(apps, leads) * 100,
      // Layer 3
      calls,
      callCost: safeDivide(adSpend, calls),
      callPercent: safeDivide(calls, apps) * 100,
      sales,
      conversionPercent: safeDivide(sales, calls) * 100,
      revenue,
      cash,
      cpa: safeDivide(adSpend, sales),
      rPnL: revenue - adSpend,
      cPnL: cash - adSpend,
      rRoi: adSpend > 0 ? ((revenue - adSpend) / adSpend) * 100 : 0,
      cRoi: adSpend > 0 ? ((cash - adSpend) / adSpend) * 100 : 0,
    };
  });
}

/** Compute totals row from an array of day rows */
export function computeTotals(rows: PaidTrafficDayRow[]): PaidTrafficDayRow {
  const sum = (fn: (r: PaidTrafficDayRow) => number) => rows.reduce((s, r) => s + fn(r), 0);

  const adSpend = sum((r) => r.adSpend);
  const impressions = sum((r) => r.impressions);
  const reach = sum((r) => r.reach);
  const clicks = sum((r) => r.clicks);
  const leads = sum((r) => r.leads);
  const apps = sum((r) => r.apps);
  const calls = sum((r) => r.calls);
  const sales = sum((r) => r.sales);
  const revenue = sum((r) => r.revenue);
  const cash = sum((r) => r.cash);

  return {
    date: "Total",
    adSpend,
    impressions,
    reach,
    cpm: safeDivide(adSpend, impressions) * 1000,
    clicks,
    ctr: safeDivide(clicks, reach) * 100,
    cpc: safeDivide(adSpend, clicks),
    leads,
    leadCost: safeDivide(adSpend, leads),
    lpCr: safeDivide(leads, clicks) * 100,
    apps,
    appCost: safeDivide(adSpend, apps),
    appPercent: safeDivide(apps, leads) * 100,
    calls,
    callCost: safeDivide(adSpend, calls),
    callPercent: safeDivide(calls, apps) * 100,
    sales,
    conversionPercent: safeDivide(sales, calls) * 100,
    revenue,
    cash,
    cpa: safeDivide(adSpend, sales),
    rPnL: revenue - adSpend,
    cPnL: cash - adSpend,
    rRoi: adSpend > 0 ? ((revenue - adSpend) / adSpend) * 100 : 0,
    cRoi: adSpend > 0 ? ((cash - adSpend) / adSpend) * 100 : 0,
  };
}

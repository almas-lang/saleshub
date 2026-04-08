/**
 * One row in the Paid Traffic tracking table — matches the Excel spreadsheet columns.
 * Layer 1 (Meta API): adSpend → cpc
 * Layer 2 (SalesHub DB): leads → appPercent
 * Layer 3 (SalesHub DB): calls → cRoi
 */
export interface PaidTrafficDayRow {
  date: string; // YYYY-MM-DD

  // Layer 1 — Ad platform (auto-pulled)
  adSpend: number;
  impressions: number;
  reach: number;
  cpm: number; // (adSpend / impressions) * 1000
  clicks: number;
  ctr: number; // (clicks / reach) * 100
  cpc: number; // adSpend / clicks

  // Layer 2 — Funnel middle (auto from DB)
  leads: number;
  leadCost: number; // adSpend / leads
  lpCr: number; // (leads / clicks) * 100
  apps: number; // bookings created
  appCost: number; // adSpend / apps
  appPercent: number; // (apps / leads) * 100

  // Layer 3 — Funnel bottom (auto from DB)
  calls: number; // completed bookings
  callCost: number; // adSpend / calls
  callPercent: number; // (calls / apps) * 100
  sales: number; // contacts converted to customer
  conversionPercent: number; // (sales / calls) * 100
  revenue: number; // invoice totals paid
  cash: number; // installments + non-installment invoices paid
  cpa: number; // adSpend / sales
  rPnL: number; // revenue - adSpend
  cPnL: number; // cash - adSpend
  rRoi: number; // ((revenue - adSpend) / adSpend) * 100
  cRoi: number; // ((cash - adSpend) / adSpend) * 100
}

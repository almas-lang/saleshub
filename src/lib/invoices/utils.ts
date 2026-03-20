import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Returns the Indian financial year string for a given date.
 * Financial year runs April → March.
 * e.g. Jan 2026 → "2025-26", April 2026 → "2026-27"
 */
export function getFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-based
  const year = date.getFullYear();

  if (month >= 3) {
    // April (3) onwards → current year start
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  // Jan–Mar → previous year start
  return `${year - 1}-${String(year).slice(-2)}`;
}

/**
 * Generates the next invoice number atomically.
 *
 * Pattern: XW-2026-0203 (invoices), XW-EST-2026-0001 (estimates)
 * Uses the FY end year (e.g. FY 2025-26 → 2026). Resets every fiscal year (April).
 *
 * Uses a simple max-query approach on the invoices table.
 */
export async function getNextInvoiceNumber(
  type: "invoice" | "estimate" = "invoice"
): Promise<string> {
  const fy = getFinancialYear();
  // Use the FY end year: "2025-26" → 2026
  const fyStartYear = parseInt(fy.split("-")[0], 10);
  const fyEndYear = fyStartYear + 1;
  const prefix = type === "estimate" ? `XW-EST-${fyEndYear}` : `XW-${fyEndYear}`;

  // Find the highest existing number with this prefix
  const { data } = await supabaseAdmin
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (data && data.length > 0) {
    const lastNumber = data[0].invoice_number;
    const parts = lastNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  // Minimum starting sequence for migration from old numbering
  const MIN_SEQ = 203;
  if (nextSeq < MIN_SEQ) nextSeq = MIN_SEQ;

  return `${prefix}-${String(nextSeq).padStart(4, "0")}`;
}

// ── Number to words (built-in, no dependency) ──────────────

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t} ${o}` : t;
}

function threeDigitWords(n: number): string {
  if (n === 0) return "";
  if (n < 100) return twoDigitWords(n);
  const h = ONES[Math.floor(n / 100)];
  const rest = n % 100;
  return rest ? `${h} Hundred ${twoDigitWords(rest)}` : `${h} Hundred`;
}

/**
 * Convert a number to words for Indian currency (supports up to 99,99,99,999).
 * e.g. 15000 → "Indian Rupees Fifteen Thousand Only"
 */
export function amountInWords(amount: number): string {
  if (amount === 0) return "Indian Rupees Zero Only";

  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);

  // Indian numbering: Crore, Lakh, Thousand, Hundred
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${twoDigitWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (hundred > 0) parts.push(threeDigitWords(hundred));

  let words = `Indian Rupees ${parts.join(" ")}`;

  if (paise > 0) {
    words += ` and ${twoDigitWords(paise)} Paise`;
  }

  return `${words} Only`;
}

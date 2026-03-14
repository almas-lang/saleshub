import type { InvoiceLineItem, GSTBreakup } from "@/types/invoices";

// Default SAC code for education/coaching services
export const DEFAULT_SAC_CODE = "999293";

// Default GST rate (18%)
export const DEFAULT_GST_RATE = 18;

// Business state
export const BUSINESS_STATE = "Karnataka";
export const BUSINESS_STATE_CODE = "29";

/**
 * Calculate GST breakup for invoice line items.
 *
 * Rules:
 * - If customer state = Karnataka (same as business) → Intra-state: CGST 9% + SGST 9%
 * - If customer state ≠ Karnataka → Inter-state: IGST 18%
 * - If customer state is unknown → defaults to IGST 18%
 */
export function calculateGST(
  items: InvoiceLineItem[],
  customerState?: string | null,
  gstRate: number = DEFAULT_GST_RATE
): GSTBreakup {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const isIntraState =
    !!customerState &&
    customerState.toLowerCase().trim() === BUSINESS_STATE.toLowerCase();

  const gstAmount = Math.round((subtotal * gstRate) / 100);

  if (isIntraState) {
    const half = Math.round(gstAmount / 2);
    return {
      subtotal,
      cgst: half,
      sgst: gstAmount - half, // avoid rounding mismatch
      igst: 0,
      total: subtotal + gstAmount,
      isIntraState: true,
      gstRate,
    };
  }

  return {
    subtotal,
    cgst: 0,
    sgst: 0,
    igst: gstAmount,
    total: subtotal + gstAmount,
    isIntraState: false,
    gstRate,
  };
}

/**
 * List of Indian states for dropdowns.
 */
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Puducherry",
  "Chandigarh",
  "Andaman & Nicobar Islands",
  "Dadra & Nagar Haveli and Daman & Diu",
  "Lakshadweep",
] as const;

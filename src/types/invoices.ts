import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/lib/supabase/types";

// Row types
export type Invoice = Tables<"invoices">;

// Insert / Update
export type InvoiceInsert = TablesInsert<"invoices">;
export type InvoiceUpdate = TablesUpdate<"invoices">;

// Enums
export type InvoiceStatus = Enums<"invoice_status">;
export type InvoiceType = Enums<"invoice_type">;
export type PaymentGateway = Enums<"payment_gateway">;
export type InstallmentStatus = Enums<"installment_status">;

// Installments
export type Installment = Tables<"installments">;

export interface InstallmentInput {
  installment_number: number;
  amount: number;
  due_date: string; // YYYY-MM-DD
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Line item stored in the `items` JSON column
export interface InvoiceLineItem {
  description: string;
  sac_code: string;   // default "999293"
  qty: number;
  rate: number;
  amount: number;     // qty * rate
}

/** Safely parse the JSON `items` column into typed line items */
export function parseInvoiceItems(items: unknown): InvoiceLineItem[] {
  if (typeof items === "string") {
    try {
      return JSON.parse(items) as InvoiceLineItem[];
    } catch {
      return [];
    }
  }
  if (Array.isArray(items)) return items as InvoiceLineItem[];
  return [];
}

// GST breakup returned by calculation
export interface GSTBreakup {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  isIntraState: boolean;
  gstRate: number;
}

// Joined invoice with contact info
export type InvoiceWithContact = Invoice & {
  contacts: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    company_name: string | null;
  } | null;
  installments?: Installment[];
};

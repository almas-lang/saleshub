// ──────────────────────────────────────────
// Bank Statement Import — Parsing & Categorization
// ──────────────────────────────────────────

export type BankImportField =
  | "date"
  | "description"
  | "debit"
  | "credit"
  | "amount"
  | "balance"
  | "reference"
  | "__skip__";

export interface BankColumnMapping {
  csvColumn: string;
  field: BankImportField;
  autoDetected: boolean;
}

export interface ParsedBankRow {
  date: string;
  description: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  gst_applicable: boolean;
  reference?: string;
  selected: boolean;
  error?: string;
}

// ──────────────────────────────────────────
// Column synonym mapping for auto-detection
// ──────────────────────────────────────────

const BANK_COLUMN_SYNONYMS: Record<string, BankImportField> = {
  // Date
  "date": "date",
  "txn date": "date",
  "transaction date": "date",
  "trans date": "date",
  "value date": "date",
  "value_date": "date",
  "posting date": "date",
  "post date": "date",
  "txn_date": "date",
  "transaction_date": "date",
  "trans_date": "date",
  // Description
  "description": "description",
  "narration": "description",
  "particulars": "description",
  "details": "description",
  "transaction details": "description",
  "remarks": "description",
  "memo": "description",
  "payee": "description",
  "transaction description": "description",
  "transaction_description": "description",
  // Debit
  "debit": "debit",
  "debit amount": "debit",
  "debit_amount": "debit",
  "withdrawal": "debit",
  "withdrawal amount": "debit",
  "withdrawal amt": "debit",
  "withdrawals": "debit",
  "dr": "debit",
  "dr amount": "debit",
  "debit(inr)": "debit",
  "debit (inr)": "debit",
  "withdrawal(inr)": "debit",
  "withdrawal (inr)": "debit",
  // Credit
  "credit": "credit",
  "credit amount": "credit",
  "credit_amount": "credit",
  "deposit": "credit",
  "deposit amount": "credit",
  "deposit amt": "credit",
  "deposits": "credit",
  "cr": "credit",
  "cr amount": "credit",
  "credit(inr)": "credit",
  "credit (inr)": "credit",
  "deposit(inr)": "credit",
  "deposit (inr)": "credit",
  // Amount (single column)
  "amount": "amount",
  "amount (inr)": "amount",
  "amount(inr)": "amount",
  "transaction amount": "amount",
  "txn amount": "amount",
  // Balance
  "balance": "balance",
  "closing balance": "balance",
  "running balance": "balance",
  "available balance": "balance",
  "balance (inr)": "balance",
  "balance(inr)": "balance",
  // Reference
  "reference": "reference",
  "ref no": "reference",
  "ref no.": "reference",
  "reference no": "reference",
  "reference number": "reference",
  "ref_no": "reference",
  "chq/ref number": "reference",
  "chq / ref number": "reference",
  "chq no": "reference",
  "cheque no": "reference",
  "utr": "reference",
  "transaction id": "reference",
  "txn id": "reference",
};

export function autoMapBankColumns(headers: string[]): BankColumnMapping[] {
  const usedFields = new Set<string>();

  return headers.map((header) => {
    const normalized = header.toLowerCase().trim();
    const match = BANK_COLUMN_SYNONYMS[normalized];

    if (match && !usedFields.has(match)) {
      usedFields.add(match);
      return { csvColumn: header, field: match, autoDetected: true };
    }

    return { csvColumn: header, field: "__skip__" as const, autoDetected: false };
  });
}

// ──────────────────────────────────────────
// Category rules for auto-categorization
// ──────────────────────────────────────────

const CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  // Advertising
  { keywords: ["GOOGLE ADS", "GOOGLE AD", "FACEBOOK", "META ADS", "META PLATFORM", "INSTAGRAM", "LINKEDIN ADS"], category: "Advertising" },
  // Software & Tools
  { keywords: ["AWS", "AMAZON WEB", "VERCEL", "GITHUB", "FIGMA", "NOTION", "SLACK", "ZOOM", "CANVA", "MICROSOFT", "GOOGLE CLOUD", "OPENAI", "ANTHROPIC", "STRIPE FEE", "RAZORPAY", "CASHFREE", "SUPABASE", "NETLIFY", "HEROKU", "DIGITAL OCEAN", "DIGITALOCEAN"], category: "Software & Tools" },
  // Food & Dining
  { keywords: ["SWIGGY", "ZOMATO", "UBER EATS", "DOMINOS", "STARBUCKS", "RESTAURANT"], category: "Miscellaneous" },
  // Taxes & Compliance
  { keywords: ["GST", "TDS", "INCOME TAX", "PROFESSIONAL TAX", "ROC FILING", "MCA", "GOVT OF INDIA", "TAX PAYMENT", "ADVANCE TAX"], category: "Taxes & Compliance" },
  // Freelancers & Contractors
  { keywords: ["FREELANCER", "CONTRACTOR", "CONSULTANT", "UPWORK", "FIVERR", "TOPTAL"], category: "Freelancers & Contractors" },
  // Communication
  { keywords: ["AIRTEL", "JIO", "VODAFONE", "VI PREPAID", "BSNL", "ACT FIBERNET"], category: "Communication (Phone/Internet)" },
  // Office & Supplies
  { keywords: ["AMAZON", "FLIPKART", "OFFICE", "FURNITURE", "STATIONERY"], category: "Office & Supplies" },
  // Travel
  { keywords: ["UBER", "OLA", "MAKEMYTRIP", "IRCTC", "INDIGO", "SPICEJET", "AIR INDIA", "HOTEL", "BOOKING.COM"], category: "Travel & Events" },
  // Training
  { keywords: ["COURSE", "UDEMY", "COURSERA", "TRAINING", "WORKSHOP", "CONFERENCE"], category: "Training & Education" },
  // Content Production
  { keywords: ["SHUTTERSTOCK", "GETTY", "ADOBE", "ENVATO", "STOCK PHOTO"], category: "Content Production" },
  // Salary & Payroll
  { keywords: ["SALARY", "PAYROLL", "EPF", "ESI", "PROVIDENT FUND", "PF CONTRIBUTION"], category: "Salary & Payroll" },
  // Bank charges
  { keywords: ["BANK CHARGE", "BANK FEE", "ANNUAL FEE", "MAINTENANCE CHARGE", "SMS CHARGE"], category: "Bank Charges" },
];

export function categorizeTransaction(description: string): string {
  const upper = description.toUpperCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => upper.includes(kw))) {
      return rule.category;
    }
  }
  return "Uncategorized";
}

// ──────────────────────────────────────────
// Amount parsing — Indian number formats
// ──────────────────────────────────────────

export function parseAmountField(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;

  let str = String(value).trim();

  // Handle brackets as negative: (1,234.56) → -1234.56
  const isBracketed = str.startsWith("(") && str.endsWith(")");
  if (isBracketed) {
    str = str.slice(1, -1);
  }

  // Remove currency symbols and whitespace
  str = str.replace(/[₹$€£\s]/g, "");

  // Handle Indian comma format: 1,23,456.78 → remove commas
  str = str.replace(/,/g, "");

  // Handle "Cr" / "Dr" suffixes
  const hasDr = /\s*dr\.?$/i.test(str);
  const hasCr = /\s*cr\.?$/i.test(str);
  str = str.replace(/\s*(dr|cr)\.?$/i, "");

  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  let result = Math.abs(num);
  if (isBracketed || hasDr) result = -result;
  if (hasCr) result = Math.abs(result);

  return result;
}

// ──────────────────────────────────────────
// Transaction type detection
// ──────────────────────────────────────────

export function detectTransactionType(
  row: Record<string, string>,
  mappings: BankColumnMapping[]
): { type: "income" | "expense"; amount: number } {
  const getVal = (field: BankImportField) => {
    const mapping = mappings.find((m) => m.field === field);
    if (!mapping) return "";
    return row[mapping.csvColumn] ?? "";
  };

  const debitStr = getVal("debit");
  const creditStr = getVal("credit");
  const amountStr = getVal("amount");

  // Separate debit/credit columns
  if (mappings.some((m) => m.field === "debit") || mappings.some((m) => m.field === "credit")) {
    const debit = parseAmountField(debitStr);
    const credit = parseAmountField(creditStr);

    if (debit > 0) return { type: "expense", amount: debit };
    if (credit > 0) return { type: "income", amount: credit };
    // Both zero or both present — use whichever is non-zero
    if (Math.abs(debit) > 0) return { type: "expense", amount: Math.abs(debit) };
    if (Math.abs(credit) > 0) return { type: "income", amount: Math.abs(credit) };
    return { type: "expense", amount: 0 };
  }

  // Single amount column — negative = expense, positive = income
  const amount = parseAmountField(amountStr);
  if (amount < 0) return { type: "expense", amount: Math.abs(amount) };
  if (amount > 0) return { type: "income", amount };
  return { type: "expense", amount: 0 };
}

// ──────────────────────────────────────────
// Parse date from bank statement
// ──────────────────────────────────────────

export function parseBankDate(raw: string): string | null {
  if (!raw) return null;
  const str = raw.trim();
  if (!str) return null;

  // ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return str.slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const day = Number(d), month = Number(m), year = Number(y);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // DD/MM/YY
  const dmyShort = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (dmyShort) {
    const [, d, m, y] = dmyShort;
    const day = Number(d), month = Number(m);
    const year = Number(y) + (Number(y) > 50 ? 1900 : 2000);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // DD MMM YYYY (e.g. "15 Mar 2026")
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const dmy2 = str.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})$/i);
  if (dmy2) {
    const [, d, m, y] = dmy2;
    const mm = monthNames[m.toLowerCase().slice(0, 3)];
    if (mm) {
      return `${y}-${mm}-${String(Number(d)).padStart(2, "0")}`;
    }
  }

  return null;
}

// ──────────────────────────────────────────
// GST-applicable categories
// ──────────────────────────────────────────

const GST_APPLICABLE_CATEGORIES = new Set([
  "Advertising",
  "Software & Tools",
  "Freelancers & Contractors",
  "Content Production",
  "Communication (Phone/Internet)",
  "Office & Supplies",
  "Training & Education",
]);

export function isGSTApplicable(description: string, category: string): boolean {
  if (description.toUpperCase().includes("GST")) return true;
  return GST_APPLICABLE_CATEGORIES.has(category);
}

// ──────────────────────────────────────────
// Full row parsing — converts raw CSV row
// ──────────────────────────────────────────

export function parseRawBankRow(
  row: Record<string, string>,
  mappings: BankColumnMapping[]
): ParsedBankRow {
  const getVal = (field: BankImportField) => {
    const mapping = mappings.find((m) => m.field === field);
    if (!mapping) return "";
    return row[mapping.csvColumn] ?? "";
  };

  const rawDate = getVal("date");
  const description = getVal("description").trim();
  const reference = getVal("reference").trim();

  const date = parseBankDate(rawDate);
  const { type, amount } = detectTransactionType(row, mappings);
  const category = type === "expense" ? categorizeTransaction(description) : "Revenue";
  const gst_applicable = type === "expense" && isGSTApplicable(description, category);

  const parsed: ParsedBankRow = {
    date: date ?? "",
    description,
    type,
    amount,
    category,
    gst_applicable,
    reference: reference || undefined,
    selected: true,
  };

  // Validation
  if (!date) parsed.error = "Invalid date";
  else if (amount === 0) parsed.error = "Zero amount";
  else if (!description) parsed.error = "No description";

  if (parsed.error) parsed.selected = false;

  return parsed;
}

// ──────────────────────────────────────────
// Validate column mappings are sufficient
// ──────────────────────────────────────────

export function validateBankMappings(mappings: BankColumnMapping[]): string | null {
  const fields = new Set(mappings.map((m) => m.field));

  if (!fields.has("date")) return "Date column is required";
  if (!fields.has("description")) return "Description column is required";

  const hasAmount = fields.has("amount");
  const hasDebitCredit = fields.has("debit") || fields.has("credit");

  if (!hasAmount && !hasDebitCredit) {
    return "Either Amount column or Debit/Credit columns are required";
  }

  return null;
}

// ──────────────────────────────────────────
// All categories for dropdown
// ──────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  "Advertising",
  "Software & Tools",
  "Freelancers & Contractors",
  "Content Production",
  "Office & Supplies",
  "Travel & Events",
  "Communication (Phone/Internet)",
  "Training & Education",
  "Taxes & Compliance",
  "Salary & Payroll",
  "Bank Charges",
  "Miscellaneous",
  "Uncategorized",
] as const;

export const INCOME_CATEGORIES = [
  "Revenue",
  "Interest",
  "Refund",
  "Other Income",
] as const;

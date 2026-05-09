export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Credit Card Statement Import
 *
 * HDFC credit card CSV typically has columns like:
 * Date, Description/Narration, Amount, Type (Debit/Credit), Reference
 *
 * This endpoint:
 * 1. Parses each charge from the statement
 * 2. Matches against logged expenses by amount + date proximity (±3 days)
 * 3. Creates bank_transaction entries for reconciliation
 * 4. Optionally creates new expense entries for unmatched charges
 */

interface CardRow {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit"; // debit = charge, credit = refund/payment
  reference?: string;
}

export async function POST(request: Request) {
  const supabase = supabaseAdmin;
  const body = await request.json();
  const { rows, month, create_unmatched } = body as {
    rows: CardRow[];
    month: string;
    create_unmatched?: boolean;
  };

  if (!rows?.length || !month) {
    return NextResponse.json(
      { error: "rows and month are required" },
      { status: 400 }
    );
  }

  // Fetch expenses for matching (wider window: month ± 1 month)
  const [yearStr, monStr] = month.split("-");
  const year = parseInt(yearStr);
  const mon = parseInt(monStr);
  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, "0")}`;
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;

  const { data: expenses } = await supabase
    .from("transactions")
    .select("id, amount, date, description, category, payment_mode")
    .eq("type", "expense")
    .gte("date", `${prevMonth}-01`)
    .lte("date", `${nextMonth}-28`)
    .order("date", { ascending: true });

  const availableExpenses = new Set((expenses ?? []).map((e) => e.id));
  const matchedExpenseIds = new Set<string>();

  let matchedCount = 0;
  let unmatchedCount = 0;
  let createdCount = 0;

  const results: {
    description: string;
    amount: number;
    date: string;
    matched: boolean;
    matched_expense?: string;
    created?: boolean;
  }[] = [];

  for (const row of rows) {
    // Only process charges (debits), skip payments/refunds
    if (row.type === "credit") continue;

    let matched = false;
    let matchedExpenseDesc: string | undefined;

    // Try exact amount match within ±3 days
    const rowDate = new Date(row.date + "T00:00:00");

    for (const exp of expenses ?? []) {
      if (matchedExpenseIds.has(exp.id)) continue;
      if (Math.abs(exp.amount - row.amount) >= 1) continue;

      const expDate = new Date(exp.date + "T00:00:00");
      const dayDiff = Math.abs((rowDate.getTime() - expDate.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDiff <= 3) {
        matched = true;
        matchedExpenseDesc = exp.description ?? exp.category;
        matchedExpenseIds.add(exp.id);

        // Update the expense's payment_mode if not set
        if (!exp.payment_mode || exp.payment_mode === "UPI") {
          await supabase
            .from("transactions")
            .update({ payment_mode: "Credit Card" })
            .eq("id", exp.id);
        }

        // Create reconciliation entry
        await supabase.from("bank_transactions").insert({
          date: row.date,
          description: `CC: ${row.description}`,
          debit: row.amount,
          credit: 0,
          reference: row.reference ?? null,
          bank_name: "HDFC Credit Card",
          month,
          reconciled: true,
          matched_type: "expense",
          matched_id: exp.id,
        });

        matchedCount++;
        break;
      }
    }

    if (!matched) {
      // Insert unmatched bank transaction
      await supabase.from("bank_transactions").insert({
        date: row.date,
        description: `CC: ${row.description}`,
        debit: row.amount,
        credit: 0,
        reference: row.reference ?? null,
        bank_name: "HDFC Credit Card",
        month,
        reconciled: false,
      });

      // Optionally create a new expense for unmatched charges
      if (create_unmatched) {
        const category = guessCategory(row.description);
        const { data: newExp } = await supabase
          .from("transactions")
          .insert({
            type: "expense",
            amount: row.amount,
            category,
            date: row.date,
            description: row.description,
            gst_applicable: false,
            payment_mode: "Credit Card",
          })
          .select("id")
          .single();

        if (newExp) {
          // Link the bank transaction to the new expense
          await supabase
            .from("bank_transactions")
            .update({
              reconciled: true,
              matched_type: "expense",
              matched_id: newExp.id,
            })
            .eq("month", month)
            .eq("description", `CC: ${row.description}`)
            .eq("debit", row.amount)
            .eq("reconciled", false)
            .limit(1);

          createdCount++;
        }
      }

      unmatchedCount++;
    }

    results.push({
      description: row.description,
      amount: row.amount,
      date: row.date,
      matched,
      matched_expense: matchedExpenseDesc,
      created: !matched && create_unmatched,
    });
  }

  return NextResponse.json({
    total: results.length,
    matched: matchedCount,
    unmatched: unmatchedCount,
    created: createdCount,
    details: results,
  });
}

/**
 * Guess expense category from credit card description.
 */
function guessCategory(desc: string): string {
  const d = desc.toLowerCase();
  const rules: [string[], string][] = [
    [["facebook", "meta", "google ads", "linkedin"], "Advertising"],
    [["aws", "azure", "gcloud", "heroku", "vercel", "railway", "netlify", "supabase", "cloudflare"], "Software & Tools"],
    [["claude", "openai", "chatgpt", "anthropic"], "Software & Tools"],
    [["figma", "canva", "adobe", "notion", "slack", "zoom", "google workspace"], "Software & Tools"],
    [["swiggy", "zomato", "restaurant", "cafe", "burger", "mcdonald", "kfc", "domino"], "Travel & Events"],
    [["uber", "ola", "rapido", "irctc", "railway", "flight", "hotel", "airbnb"], "Travel & Events"],
    [["airtel", "jio", "vodafone", "bsnl", "broadband", "wifi"], "Communication (Phone/Internet)"],
    [["amazon", "flipkart", "myntra"], "Office & Supplies"],
    [["udemy", "coursera", "skillshare", "uability"], "Training & Education"],
    [["gst", "tax", "income tax", "tds"], "Taxes & Compliance"],
    [["bescom", "bwssb", "electricity", "water"], "Office & Supplies"],
  ];

  for (const [keywords, category] of rules) {
    if (keywords.some((k) => d.includes(k))) return category;
  }

  return "Miscellaneous";
}

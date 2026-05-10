export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exportMultiSheetXLSX, type SheetData } from "@/lib/finance/export";
import { parseInvoiceItems } from "@/types/invoices";
import { calculateGST } from "@/lib/invoices/gst";

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function getMonthLabel(month: string): string {
  const d = new Date(month + "-01T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month query param required (YYYY-MM)" }, { status: 400 });
  }

  const supabase = supabaseAdmin;
  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  const monStr = String(mon).padStart(2, "0");

  // Check if reconciliation batch exists for this month
  const { data: batch } = await supabase
    .from("reconciliation_batches")
    .select("id")
    .eq("month", monStr)
    .eq("year", year)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // ══════════════════════════════════════════════════
  // SALES SHEET
  // ══════════════════════════════════════════════════
  // Primary: reconciled earnings (invoices confirmed in bank)
  // Supplement: paid invoices not covered by reconciliation

  const reconciledInvoiceIds = new Set<string>();
  const salesRows: Record<string, unknown>[] = [];
  let srNo = 1;

  if (batch) {
    // Get all reconciled earnings from the batch
    const { data: earnings } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("batch_id", batch.id)
      .eq("reconciled", true)
      .gt("credit", 0)
      .not("matched_type", "eq", "credit_card_payment")
      .order("date", { ascending: true });

    for (const txn of earnings ?? []) {
      if (txn.matched_id && (txn.matched_type === "invoice" || txn.bank_name === "Cashfree")) {
        reconciledInvoiceIds.add(txn.matched_id);

        // Fetch invoice details for the report
        const { data: inv } = await supabase
          .from("invoices")
          .select("*, contacts(first_name, last_name, email, phone, company_name)")
          .eq("id", txn.matched_id)
          .single();

        if (inv) {
          const contact = inv.contacts as { first_name: string; last_name: string | null; email: string | null; phone: string | null; company_name: string | null } | null;
          const items = parseInvoiceItems(inv.items);
          const gst = calculateGST(items, null, inv.gst_rate ?? 18);

          salesRows.push({
            "Sr.No": srNo++,
            "Invoice No": inv.invoice_number,
            "Date of Invoice": fmtDate(inv.created_at.split("T")[0]),
            "Name of the customer": contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() : txn.description,
            "Email ID": contact?.email ?? "",
            "Mobile number": contact?.phone ?? "",
            "Place": "Online",
            "GST NO,if applicable": inv.gst_number || "No",
            "Nature of Product": "XW-Current",
            "Taxable Value": gst.subtotal || "",
            "CGST": gst.cgst || "",
            "SGST": gst.sgst || "",
            "IGST": gst.igst || "",
            "Total Invoice value": inv.total,
            "Date of Receipt": fmtDate(txn.date),
            "Amount of Receipt": txn.credit,
            "Mode of receipt": txn.bank_name === "Cashfree" ? "Cashfree" : "UPI",
            "Mail Status": "Sent",
            "Remarks": txn.bank_name === "Cashfree" ? "Via Cashfree" : "Direct UPI",
            "Reconciled": "Yes",
          });
        }
      }
    }
  }

  // Supplement: paid invoices this month NOT in reconciliation
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, contacts(first_name, last_name, email, phone, company_name)")
    .eq("status", "paid")
    .eq("has_installments", false)
    .gte("paid_at", `${from}T00:00:00`)
    .lte("paid_at", `${to}T23:59:59`)
    .order("paid_at", { ascending: true });

  for (const inv of invoices ?? []) {
    if (reconciledInvoiceIds.has(inv.id)) continue; // Already in reconciled data
    const contact = inv.contacts as { first_name: string; last_name: string | null; email: string | null; phone: string | null; company_name: string | null } | null;
    const items = parseInvoiceItems(inv.items);
    const gst = calculateGST(items, null, inv.gst_rate ?? 18);

    salesRows.push({
      "Sr.No": srNo++,
      "Invoice No": inv.invoice_number,
      "Date of Invoice": fmtDate(inv.created_at.split("T")[0]),
      "Name of the customer": contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() : "",
      "Email ID": contact?.email ?? "",
      "Mobile number": contact?.phone ?? "",
      "Place": "Online",
      "GST NO,if applicable": inv.gst_number || "No",
      "Nature of Product": "XW-Current",
      "Taxable Value": gst.subtotal || "",
      "CGST": gst.cgst || "",
      "SGST": gst.sgst || "",
      "IGST": gst.igst || "",
      "Total Invoice value": inv.total,
      "Date of Receipt": inv.paid_at ? fmtDate(inv.paid_at.split("T")[0]) : "",
      "Amount of Receipt": inv.total,
      "Mode of receipt": inv.payment_gateway === "cashfree" ? "Cashfree" : "UPI",
      "Mail Status": "Sent",
      "Remarks": "",
      "Reconciled": batch ? "No" : "",
    });
  }

  // Supplement: paid installments this month NOT in reconciliation
  const { data: paidInstallments } = await supabase
    .from("installments")
    .select("*, invoices!inner(*, contacts(first_name, last_name, email, phone, company_name))")
    .eq("status", "paid")
    .gte("paid_at", `${from}T00:00:00`)
    .lte("paid_at", `${to}T23:59:59`)
    .order("paid_at", { ascending: true });

  for (const inst of paidInstallments ?? []) {
    const inv = inst.invoices as unknown as {
      id: string; invoice_number: string; created_at: string; total: number;
      gst_number: string | null; payment_gateway: string | null;
      contacts: { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null;
    };
    if (reconciledInvoiceIds.has(inv.id)) continue;
    const contact = inv.contacts;

    salesRows.push({
      "Sr.No": srNo++,
      "Invoice No": inv.invoice_number,
      "Date of Invoice": fmtDate(inv.created_at.split("T")[0]),
      "Name of the customer": contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() : "",
      "Email ID": contact?.email ?? "",
      "Mobile number": contact?.phone ?? "",
      "Place": "Online",
      "GST NO,if applicable": inv.gst_number || "No",
      "Nature of Product": "XW-Current",
      "Taxable Value": "",
      "CGST": "",
      "SGST": "",
      "IGST": "",
      "Total Invoice value": inv.total,
      "Date of Receipt": inst.paid_at ? fmtDate(inst.paid_at.split("T")[0]) : "",
      "Amount of Receipt": inst.amount,
      "Mode of receipt": inst.payment_gateway === "cashfree" ? "Cashfree" : "UPI",
      "Mail Status": "Sent",
      "Remarks": `Installment #${inst.installment_number}`,
      "Reconciled": batch ? "No" : "",
    });
  }

  // Totals
  const totalReceipts = salesRows.reduce((s, r) => s + (Number(r["Amount of Receipt"]) || 0), 0);
  salesRows.push({
    "Sr.No": "", "Invoice No": "", "Date of Invoice": "", "Name of the customer": "",
    "Email ID": "", "Mobile number": "", "Place": "", "GST NO,if applicable": "",
    "Nature of Product": "", "Taxable Value": "", "CGST": "", "SGST": "", "IGST": "",
    "Total Invoice value": "", "Date of Receipt": "", "Amount of Receipt": totalReceipts,
    "Mode of receipt": "", "Mail Status": "", "Remarks": "", "Reconciled": "",
  });

  // ══════════════════════════════════════════════════
  // EXPENSES SHEET
  // ══════════════════════════════════════════════════
  // Primary: reconciled spends (expenses confirmed in bank)
  // Supplement: manually-added expenses not linked to any bank transaction

  const reconciledExpenseIds = new Set<string>();
  const expenseRows: Record<string, unknown>[] = [];
  let expSrNo = 1;

  if (batch) {
    // Get reconciled spends
    const { data: spends } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("batch_id", batch.id)
      .eq("reconciled", true)
      .gt("debit", 0)
      .not("matched_type", "in", '("salary","ignored","credit_card_payment")')
      .order("date", { ascending: true });

    for (const txn of spends ?? []) {
      if (txn.matched_id) reconciledExpenseIds.add(txn.matched_id);

      // Fetch expense details if linked
      let expDesc = txn.description;
      let expCategory = "Miscellaneous";
      let vendorGstin = "";
      let gstRate = 0;
      let gstCgst: number | string = "";
      let gstSgst: number | string = "";
      let gstIgst: number | string = "";
      let taxableValue: number | string = "";
      let paymentMode = txn.bank_name ?? "Bank";

      if (txn.matched_id) {
        const { data: exp } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", txn.matched_id)
          .single();
        if (exp) {
          expDesc = exp.description ?? exp.category;
          expCategory = exp.category;
          vendorGstin = exp.vendor_gstin ?? "";
          gstRate = exp.gst_rate ?? 0;
          gstCgst = exp.gst_cgst ?? "";
          gstSgst = exp.gst_sgst ?? "";
          gstIgst = exp.gst_igst ?? "";
          taxableValue = gstRate > 0 ? Math.round(exp.amount / (1 + gstRate / 100)) : "";
          paymentMode = exp.payment_mode ?? "Bank";
        }
      }

      expenseRows.push({
        "Sr.No": expSrNo++,
        "Date of Expenses": fmtDate(txn.date),
        "Name of the party from whom purchased": expDesc,
        "Place": "Bangalore",
        "GSTN, if available ": vendorGstin,
        "Nature of Expenditure ": expCategory,
        "Taxable Value": taxableValue,
        "CGST": gstCgst,
        "SGST": gstSgst,
        "IGST": gstIgst,
        "Total": txn.debit,
        "Payment Date ": fmtDate(txn.date),
        "Amount Paid ": txn.debit,
        "Mode of payment (Cash/Bank)": paymentMode,
        "Reconciled": "Yes",
      });
    }
  }

  // Supplement: expenses not linked to reconciliation
  const { data: allExpenses } = await supabase
    .from("transactions")
    .select("*")
    .eq("type", "expense")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  for (const exp of allExpenses ?? []) {
    if (reconciledExpenseIds.has(exp.id)) continue; // Already in reconciled data
    expenseRows.push({
      "Sr.No": expSrNo++,
      "Date of Expenses": fmtDate(exp.date),
      "Name of the party from whom purchased": exp.description ?? exp.category,
      "Place": "Bangalore",
      "GSTN, if available ": exp.vendor_gstin ?? "",
      "Nature of Expenditure ": exp.category,
      "Taxable Value": exp.gst_applicable && exp.gst_rate ? Math.round(exp.amount / (1 + exp.gst_rate / 100)) : "",
      "CGST": exp.gst_cgst ?? "",
      "SGST": exp.gst_sgst ?? "",
      "IGST": exp.gst_igst ?? "",
      "Total": exp.amount,
      "Payment Date ": fmtDate(exp.date),
      "Amount Paid ": exp.amount,
      "Mode of payment (Cash/Bank)": exp.payment_mode ?? "UPI",
      "Reconciled": batch ? "No (manual)" : "",
    });
  }

  // Totals
  const totalExpenses = expenseRows.reduce((s, r) => s + (Number(r["Amount Paid "]) || 0), 0);
  expenseRows.push({
    "Sr.No": "", "Date of Expenses": "", "Name of the party from whom purchased": "",
    "Place": "", "GSTN, if available ": "", "Nature of Expenditure ": "",
    "Taxable Value": "", "CGST": "", "SGST": "", "IGST": "", "Total": "",
    "Payment Date ": "", "Amount Paid ": totalExpenses, "Mode of payment (Cash/Bank)": "", "Reconciled": "",
  });

  // ══════════════════════════════════════════════════
  // SALARY SHEET
  // ══════════════════════════════════════════════════
  // Salary payments are always from the salary_payments table
  // Reconciliation just confirms them, doesn't create new ones

  const { data: salaryPayments } = await supabase
    .from("salary_payments")
    .select("*")
    .gte("paid_date", from)
    .lte("paid_date", to)
    .order("paid_date", { ascending: true });

  const salaryRows: Record<string, unknown>[] = [];
  for (const sp of salaryPayments ?? []) {
    salaryRows.push({
      "Employee name": sp.employee_name,
      "Employee number": sp.employee_number,
      "Paid": fmtDate(sp.paid_date),
      "Amount": sp.amount,
      "Notes": sp.notes ?? "",
    });
  }

  // Build sheets
  const monthLabel = getMonthLabel(month);
  const companyHeader = "Name of the Company :EXPWAVE PRIVATE LIMITED";

  const sheets: SheetData[] = [
    {
      name: "Sales",
      headerRows: [
        ["SALES  DETAILS  FORMAT "],
        [companyHeader],
        ["Month  :", monthLabel],
        batch ? ["Reconciliation Status:", "Reconciled"] : [],
        [],
      ],
      rows: salesRows,
    },
    {
      name: "Expenses",
      headerRows: [
        [companyHeader],
        ["Month  :", monthLabel],
        batch ? ["Reconciliation Status:", "Reconciled"] : [],
        [],
      ],
      rows: expenseRows,
    },
    {
      name: "Salary",
      headerRows: [],
      rows: salaryRows,
    },
  ];

  const result = await exportMultiSheetXLSX(sheets, `${monthLabel} Expwave - Sales and expenses`);

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}

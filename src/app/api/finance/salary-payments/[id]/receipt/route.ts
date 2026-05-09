export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { amountInWords } from "@/lib/invoices/utils";
import { SalaryReceiptPDF } from "@/lib/pdf/salary-receipt-template";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: payment, error } = await supabase
    .from("salary_payments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !payment) {
    return NextResponse.json(
      { error: error?.message ?? "Payment not found" },
      { status: 404 }
    );
  }

  const pdfBuffer = await renderToBuffer(
    SalaryReceiptPDF({
      employeeName: payment.employee_name,
      employeeNumber: payment.employee_number,
      amount: payment.amount,
      paidDate: payment.paid_date,
      paymentMode: payment.payment_mode ?? "UPI",
      notes: payment.notes,
      amountInWords: amountInWords(payment.amount),
    })
  );

  // Upload to Supabase Storage
  const fileName = `salary-receipts/${payment.employee_number}-${payment.paid_date}.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("documents")
    .upload(fileName, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("Salary receipt upload error:", uploadError.message);
  } else {
    const { data: urlData } = supabaseAdmin.storage
      .from("documents")
      .getPublicUrl(fileName);

    if (urlData?.publicUrl) {
      await supabaseAdmin
        .from("salary_payments")
        .update({ receipt_url: urlData.publicUrl })
        .eq("id", id);
    }
  }

  const uint8Array = new Uint8Array(pdfBuffer);

  return new NextResponse(uint8Array, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="salary-receipt-${payment.employee_number}-${payment.paid_date}.pdf"`,
    },
  });
}

/**
 * Cashfree Payment Links API wrapper
 *
 * Creates payment links for invoices using Cashfree's Payment Links API.
 * Docs: https://docs.cashfree.com/docs/payment-links
 */

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID!;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY!;
const CASHFREE_ENV = process.env.CASHFREE_ENV ?? "sandbox";

const BASE_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg/links"
    : "https://sandbox.cashfree.com/pg/links";

export interface CashfreePaymentLinkResult {
  success: boolean;
  paymentLink?: string;
  linkId?: string;
  error?: string;
}

/**
 * Create a Cashfree payment link for an invoice.
 */
export async function createCashfreePaymentLink(
  invoiceId: string,
  amount: number,
  customerEmail: string,
  customerPhone: string,
  customerName: string
): Promise<CashfreePaymentLinkResult> {
  try {
    const linkId = `inv_${invoiceId.slice(0, 8)}_${Date.now()}`;

    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
      },
      body: JSON.stringify({
        link_id: linkId,
        link_amount: amount,
        link_currency: "INR",
        link_purpose: `Invoice Payment - ${invoiceId.slice(0, 8)}`,
        customer_details: {
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone.replace(/\D/g, "").slice(-10),
        },
        link_notify: {
          send_sms: false,
          send_email: false, // We handle notifications ourselves
        },
        link_meta: {
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${invoiceId}?payment=success`,
          notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/cashfree`,
        },
        link_expiry_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Cashfree] Error:", data);
      return { success: false, error: data.message ?? "Failed to create payment link" };
    }

    return {
      success: true,
      paymentLink: data.link_url,
      linkId: data.link_id,
    };
  } catch (error) {
    console.error("[Cashfree] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verify Cashfree webhook signature.
 */
export function verifyCashfreeSignature(
  rawBody: string,
  signature: string
): boolean {
  try {
    const crypto = require("crypto");
    const hmac = crypto
      .createHmac("sha256", CASHFREE_SECRET_KEY)
      .update(rawBody)
      .digest("base64");
    return hmac === signature;
  } catch {
    return false;
  }
}

/**
 * Cashfree Payment Links API wrapper
 *
 * Creates payment links for invoices using Cashfree's Payment Links API.
 * Docs: https://docs.cashfree.com/docs/payment-links
 */

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID!;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY!;
const CASHFREE_ENV = process.env.CASHFREE_ENV ?? "sandbox";

const ORDERS_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg/orders"
    : "https://sandbox.cashfree.com/pg/orders";

export interface CashfreeOrderResult {
  success: boolean;
  orderId?: string;
  paymentSessionId?: string;
  error?: string;
}

/**
 * Create a Cashfree PG order for an invoice.
 * Returns a payment_session_id used by the Cashfree JS SDK checkout.
 */
export async function createCashfreeOrder(
  invoiceId: string,
  amount: number,
  customerEmail: string,
  customerPhone: string,
  customerName: string
): Promise<CashfreeOrderResult> {
  try {
    const cleanPhone = customerPhone.replace(/\D/g, "").slice(-10);
    const phone = cleanPhone.length === 10 ? cleanPhone : "9999999999";

    const suffix = Date.now().toString(36);
    const orderId = `inv-${invoiceId}-${suffix}`.slice(0, 45);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const payload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: invoiceId.slice(0, 50),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: phone,
      },
      order_meta: {
        return_url: `${appUrl}/invoice/${invoiceId}?payment=success`,
        notify_url: `${appUrl}/api/webhooks/cashfree`,
      },
      order_expiry_time: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };

    console.log("[Cashfree] Creating PG order:", {
      orderId,
      amount,
      email: customerEmail,
      env: CASHFREE_ENV,
    });

    const response = await fetch(ORDERS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Cashfree] Order error:", JSON.stringify(data));
      return {
        success: false,
        error: data.message ?? JSON.stringify(data),
      };
    }

    console.log("[Cashfree] Order created:", orderId);
    return {
      success: true,
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id,
    };
  } catch (error) {
    console.error("[Cashfree] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get an existing Cashfree order to retrieve its payment_session_id.
 */
export async function getCashfreeOrder(
  orderId: string
): Promise<CashfreeOrderResult> {
  try {
    const response = await fetch(`${ORDERS_URL}/${orderId}`, {
      headers: {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message ?? JSON.stringify(data),
      };
    }

    return {
      success: true,
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id,
    };
  } catch (error) {
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

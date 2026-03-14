/**
 * Stripe Checkout Session wrapper
 *
 * Creates checkout sessions for invoice payments.
 * Will be activated once `stripe` package is installed via:
 *   bun add stripe  (or npm install stripe)
 */

export interface StripeCheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}

/**
 * Create a Stripe checkout session for an invoice.
 */
export async function createStripeCheckoutSession(
  invoiceId: string,
  amount: number,
  customerEmail: string,
  description?: string
): Promise<StripeCheckoutResult> {
  // Stripe SDK not available — return error
  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, error: "Stripe is not configured. Set STRIPE_SECRET_KEY." };
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "payment_method_types[0]": "card",
        "line_items[0][price_data][currency]": "inr",
        "line_items[0][price_data][product_data][name]": description ?? "Invoice Payment",
        "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
        "line_items[0][quantity]": "1",
        mode: "payment",
        success_url: `${appUrl}/invoices/${invoiceId}?payment=success`,
        cancel_url: `${appUrl}/invoices/${invoiceId}?payment=cancelled`,
        customer_email: customerEmail,
        "metadata[invoice_id]": invoiceId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message ?? "Stripe API error" };
    }

    return {
      success: true,
      checkoutUrl: data.url ?? undefined,
      sessionId: data.id,
    };
  } catch (error) {
    console.error("[Stripe] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verify Stripe webhook signature using raw HMAC.
 */
export function constructStripeEvent(
  rawBody: string | Buffer,
  signature: string
): Record<string, unknown> | null {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return null;

    const crypto = require("crypto");
    const parts = signature.split(",").reduce(
      (acc: Record<string, string>, part: string) => {
        const [key, value] = part.split("=");
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>
    );

    const timestamp = parts["t"];
    const sig = parts["v1"];
    if (!timestamp || !sig) return null;

    const payload = `${timestamp}.${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (expected !== sig) return null;

    return JSON.parse(typeof rawBody === "string" ? rawBody : rawBody.toString("utf8"));
  } catch (error) {
    console.error("[Stripe] Webhook verification failed:", error);
    return null;
  }
}

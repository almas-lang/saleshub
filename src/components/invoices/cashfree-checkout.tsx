"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface CashfreeCheckoutProps {
  paymentSessionId: string;
  mode: "sandbox" | "production";
}

declare global {
  interface Window {
    Cashfree: (config: { mode: string }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget: string;
      }) => Promise<void>;
    };
  }
}

export function CashfreeCheckout({ paymentSessionId, mode }: CashfreeCheckoutProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const launched = useRef(false);

  useEffect(() => {
    if (!sdkReady || launched.current) return;
    launched.current = true;

    const run = () => {
      try {
        const cashfree = window.Cashfree({ mode });
        cashfree.checkout({
          paymentSessionId,
          redirectTarget: "_self",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open checkout");
      }
    };
    run();
  }, [sdkReady, paymentSessionId, mode]);

  return (
    <>
      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        onReady={() => setSdkReady(true)}
        onError={() => setError("Failed to load payment SDK")}
      />
      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
          <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Redirecting to payment...
        </div>
      )}
    </>
  );
}

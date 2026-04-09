"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    if (!token) setStatus("error");
  }, [token]);

  async function handleUnsubscribe() {
    setStatus("loading");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        backgroundColor: "#fafafa",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
          padding: "48px 32px",
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        {status === "success" ? (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#10003;</div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}>
              You&apos;ve been unsubscribed
            </h1>
            <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
              You will no longer receive marketing emails from us.
            </p>
          </>
        ) : status === "error" ? (
          <>
            <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
              This unsubscribe link may be invalid or expired.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}>
              Unsubscribe
            </h1>
            <p style={{ fontSize: "14px", color: "#666", margin: "0 0 24px" }}>
              Click below to stop receiving marketing emails from Xperience Wave.
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={status === "loading"}
              style={{
                backgroundColor: "#222",
                color: "#fff",
                border: "none",
                padding: "12px 32px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: status === "loading" ? "not-allowed" : "pointer",
                opacity: status === "loading" ? 0.6 : 1,
              }}
            >
              {status === "loading" ? "Unsubscribing..." : "Confirm Unsubscribe"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        />
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}

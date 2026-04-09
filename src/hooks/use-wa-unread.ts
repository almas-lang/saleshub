"use client";

import { useCallback, useEffect, useState } from "react";
import { safeFetch } from "@/lib/fetch";

/**
 * Polls for unread WhatsApp message count.
 * Returns the count of inbound WA messages not yet seen.
 * Uses notifications table (unread WA notifications = unread messages).
 */
export function useWaUnread() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const result = await safeFetch<{ count: number }>(
      "/api/whatsapp/unread"
    );
    if (result.ok) {
      setCount(result.data.count);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { count, refresh };
}

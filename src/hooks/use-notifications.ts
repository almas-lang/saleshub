"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { safeFetch } from "@/lib/fetch";
import type { Notification } from "@/types/contacts";

interface NotificationsResponse {
  data: Notification[];
  unread_count: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const result = await safeFetch<NotificationsResponse>("/api/notifications");
    if (result.ok) {
      setNotifications(result.data.data);
      setUnreadCount(result.data.unread_count);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  const markAsRead = useCallback(
    async (ids: string[]) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - ids.length));

      await safeFetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    await safeFetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }, []);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh };
}

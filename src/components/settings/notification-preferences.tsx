"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { safeFetch } from "@/lib/fetch";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface NotificationPreferencesProps {
  initialPreferences: Record<string, boolean>;
}

const NOTIFICATION_TYPES = [
  {
    key: "new_lead_assigned",
    label: "New lead assigned",
    description: "Get notified when a new lead is assigned to you.",
  },
  {
    key: "task_overdue",
    label: "Task overdue",
    description: "Get notified when a task passes its due date.",
  },
  {
    key: "booking_created",
    label: "Booking created",
    description: "Get notified when a new booking is made.",
  },
  {
    key: "daily_digest_email",
    label: "Daily digest email",
    description: "Receive a daily email summary of your activity.",
  },
  {
    key: "weekly_analytics_email",
    label: "Weekly analytics email",
    description: "Receive a weekly analytics summary every Monday at 8 AM IST.",
  },
  {
    key: "payment_received",
    label: "Payment received",
    description: "Get notified when a payment is received on an invoice.",
  },
] as const;

export function NotificationPreferences({
  initialPreferences,
}: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    for (const t of NOTIFICATION_TYPES) {
      defaults[t.key] = initialPreferences[t.key] ?? true;
    }
    return defaults;
  });
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    setSaving(true);
    const result = await safeFetch("/api/settings/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: prefs }),
    });

    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success("Notification preferences saved");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 space-y-6">
        {NOTIFICATION_TYPES.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={key} className="text-sm font-medium">
                {label}
              </Label>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Switch
              id={key}
              checked={prefs[key] ?? true}
              onCheckedChange={() => toggle(key)}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}

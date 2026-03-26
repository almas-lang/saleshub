"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { safeFetch } from "@/lib/fetch";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface NotificationPreferencesProps {
  initialPreferences: Record<string, boolean>;
}

const NOTIFICATION_GROUPS = [
  {
    heading: "Activity",
    description: "Stay on top of leads, tasks, and bookings.",
    items: [
      {
        key: "new_lead_assigned",
        label: "New lead assigned",
        description: "Get notified when a new lead is assigned to you.",
        channel: "In-App",
      },
      {
        key: "task_overdue",
        label: "Task overdue",
        description: "Get notified when a task passes its due date.",
        channel: "In-App",
      },
      {
        key: "booking_created",
        label: "Booking created",
        description: "Get notified when a new booking is made.",
        channel: "In-App",
      },
    ],
  },
  {
    heading: "Digest",
    description: "Periodic summaries delivered to your email.",
    items: [
      {
        key: "daily_digest_email",
        label: "Daily digest email",
        description: "Receive a daily email summary of your activity.",
        channel: "Email",
      },
      {
        key: "weekly_analytics_email",
        label: "Weekly analytics email",
        description: "Receive a weekly analytics summary every Monday at 8 AM IST.",
        channel: "Email",
      },
    ],
  },
  {
    heading: "Payments",
    description: "Get notified about incoming payments.",
    items: [
      {
        key: "payment_received",
        label: "Payment received",
        description: "Get notified when a payment is received on an invoice.",
        channel: "Email",
      },
    ],
  },
] as const;

const ALL_KEYS = NOTIFICATION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export function NotificationPreferences({
  initialPreferences,
}: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    for (const key of ALL_KEYS) {
      defaults[key] = initialPreferences[key] ?? true;
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
      <div className="rounded-xl border bg-card p-6 space-y-0">
        {NOTIFICATION_GROUPS.map((group, gi) => (
          <div key={group.heading}>
            {gi > 0 && <Separator className="my-6" />}
            <div className="mb-4">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {group.description}
              </p>
            </div>
            <div className="space-y-5">
              {group.items.map(({ key, label, description, channel }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={key} className="text-sm font-medium">
                        {label}
                      </Label>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-normal"
                      >
                        {channel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <Switch
                    id={key}
                    checked={prefs[key] ?? true}
                    onCheckedChange={() => toggle(key)}
                  />
                </div>
              ))}
            </div>
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

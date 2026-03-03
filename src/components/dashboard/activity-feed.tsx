import Link from "next/link";
import {
  MessageCircle,
  Phone,
  Mail,
  MailOpen,
  ArrowRight,
  CalendarCheck,
  IndianRupee,
  FileText,
  StickyNote,
  Activity,
} from "lucide-react";
import { cn, timeAgo, formatCurrency } from "@/lib/utils";
import type { DashboardActivity } from "@/types/dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

const ACTIVITY_CONFIG: Record<
  string,
  { icon: React.ReactNode; bg: string; text: string }
> = {
  stage_change: {
    icon: <ArrowRight className="size-3.5" />,
    bg: "bg-primary/10",
    text: "text-primary",
  },
  email_sent: {
    icon: <Mail className="size-3.5" />,
    bg: "bg-blue-500/10",
    text: "text-blue-500",
  },
  email_opened: {
    icon: <MailOpen className="size-3.5" />,
    bg: "bg-blue-500/10",
    text: "text-blue-500",
  },
  wa_sent: {
    icon: <MessageCircle className="size-3.5" />,
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
  },
  wa_delivered: {
    icon: <MessageCircle className="size-3.5" />,
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
  },
  wa_read: {
    icon: <MessageCircle className="size-3.5" />,
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
  },
  call: {
    icon: <Phone className="size-3.5" />,
    bg: "bg-amber-500/10",
    text: "text-amber-600",
  },
  note: {
    icon: <StickyNote className="size-3.5" />,
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
  booking_created: {
    icon: <CalendarCheck className="size-3.5" />,
    bg: "bg-primary/10",
    text: "text-primary",
  },
  payment_received: {
    icon: <IndianRupee className="size-3.5" />,
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
  },
  invoice_sent: {
    icon: <FileText className="size-3.5" />,
    bg: "bg-blue-500/10",
    text: "text-blue-500",
  },
  form_submitted: {
    icon: <FileText className="size-3.5" />,
    bg: "bg-primary/10",
    text: "text-primary",
  },
};

const defaultConfig = {
  icon: <Activity className="size-3.5" />,
  bg: "bg-muted",
  text: "text-muted-foreground",
};

export function ActivityFeed({
  activities,
}: {
  activities: DashboardActivity[];
}) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Activities will appear here as you interact with prospects."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* Vertical timeline line */}
          <div className="absolute left-[13px] top-1 bottom-1 w-px bg-border" />

          {activities.map((activity) => {
            const config = ACTIVITY_CONFIG[activity.type] ?? defaultConfig;
            const paymentAmount =
              activity.type === "payment_received" && activity.metadata?.amount
                ? Number(activity.metadata.amount)
                : null;

            return (
              <div key={activity.id} className="relative flex gap-3">
                {/* Icon circle */}
                <div
                  className={cn(
                    "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full",
                    config.bg,
                    config.text
                  )}
                >
                  {config.icon}
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm leading-tight">
                    {activity.contact_name && (
                      <span className="font-medium">{activity.contact_name}</span>
                    )}
                    {activity.contact_name ? " — " : ""}
                    {activity.title}
                    {paymentAmount !== null && (
                      <span className="ml-1 font-medium text-emerald-600">
                        {formatCurrency(paymentAmount)}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {timeAgo(activity.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* View all link */}
        <div className="mt-4 border-t pt-3 text-center">
          <Link
            href="/prospects"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all activity &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

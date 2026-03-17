"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Megaphone,
  FileBarChart,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FINANCE_TABS = [
  { label: "Overview", href: "/finance", icon: LayoutDashboard },
  { label: "Expenses", href: "/finance/expenses", icon: Receipt },
  { label: "Ad Spend", href: "/finance/ad-spend", icon: Megaphone },
  { label: "Reports", href: "/finance/reports", icon: FileBarChart },
  { label: "Import", href: "/finance/import", icon: Upload },
] as const;

export function FinanceNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b pb-3">
      {FINANCE_TABS.map((tab) => {
        const isActive =
          tab.href === "/finance"
            ? pathname === "/finance"
            : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  GitBranch,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Prospects", href: "/prospects", icon: Users },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Funnels", href: "/funnels", icon: GitBranch },
] as const;

interface BottomTabBarProps {
  onMoreClick: () => void;
}

export function BottomTabBar({ onMoreClick }: BottomTabBarProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 items-center justify-around">
        {TABS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium text-muted-foreground transition-colors"
        >
          <Menu className="size-5" />
          More
        </button>
      </div>
    </nav>
  );
}

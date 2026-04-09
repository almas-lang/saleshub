"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  GitBranch,
  Megaphone,
  MessageCircle,
  Mail,
  Calendar,
  Receipt,
  IndianRupee,
  BarChart3,
  CheckSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, CURRENT_PHASE } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWaUnread } from "@/hooks/use-wa-unread";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  UserCheck,
  GitBranch,
  Megaphone,
  MessageCircle,
  Mail,
  Calendar,
  Receipt,
  IndianRupee,
  BarChart3,
  CheckSquare,
};

interface SidebarProps {
  /** Called after any nav link is clicked (used to close mobile sheet). */
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const pathname = usePathname();
  const { count: waUnread } = useWaUnread();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/dashboard" className="text-lg font-semibold text-white">
          SalesHub
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map((group) => (
          <div key={group.group} className="mb-1">
            <p className="px-4 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
              {group.group}
            </p>
            {group.items.map((item) => {
              const Icon = ICON_MAP[item.icon];
              const isActive = pathname.startsWith(item.href);
              const isLocked = item.phase > CURRENT_PHASE;

              if (isLocked) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/coming-soon?module=${item.name}`}
                        onClick={onNavigate}
                        className="mx-2 flex items-center gap-2.5 rounded-md px-3 h-9 text-sm text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent/50"
                      >
                        {Icon && <Icon className="size-4" />}
                        <span>{item.name}</span>
                        <span className="ml-auto rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-sidebar-foreground/50">
                          Soon
                        </span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Coming in Phase {item.phase}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "relative mx-2 flex items-center gap-2.5 rounded-lg px-3 h-9 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-white font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-primary" />
                  )}
                  {Icon && <Icon className="size-4" />}
                  <span>{item.name}</span>
                  {item.href === "/whatsapp/chat" && waUnread > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                      {waUnread > 99 ? "99+" : waUnread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="border-t border-sidebar-border px-2 py-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 h-9 text-sm transition-colors",
            pathname.startsWith("/settings")
              ? "bg-sidebar-accent text-white font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white"
          )}
        >
          <Settings className="size-4" />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );
}

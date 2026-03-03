"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  Search,
  Plus,
  UserPlus,
  MessageCircle,
  Receipt,
  CalendarPlus,
  LogOut,
  User as UserIcon,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { CURRENT_PHASE } from "@/lib/constants";
import { useBreadcrumbs } from "./breadcrumb-context";
import { GlobalSearch } from "./global-search";
import { NotificationPopover } from "./notification-popover";

interface TopbarProps {
  onMenuClick: () => void;
  userEmail: string;
}

export function Topbar({ onMenuClick, userEmail }: TopbarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const { items: breadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    router.push("/login");
    router.refresh();
  }

  const initials = userEmail
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="size-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {breadcrumbs.length > 0 ? (
          <nav className="flex flex-1 items-center gap-1 overflow-hidden">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && (
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {isLast || !crumb.href ? (
                    <span className="text-sm font-medium text-foreground truncate">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="text-sm text-muted-foreground hover:text-foreground whitespace-nowrap"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        {/* Search */}
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-2 text-muted-foreground sm:flex"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-4" />
          <span className="text-sm">Search...</span>
          <kbd className="pointer-events-none ml-2 inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-5" />
        </Button>

        {/* Quick actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="size-8 rounded-lg">
              <Plus className="size-4" />
              <span className="sr-only">Quick actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => router.push("/prospects?action=new")}>
              <UserPlus className="mr-2 size-4" />
              Add prospect
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={CURRENT_PHASE < 2}
              onClick={() => router.push("/whatsapp")}
            >
              <MessageCircle className="mr-2 size-4" />
              Send message
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={CURRENT_PHASE < 3}
              onClick={() => router.push("/invoices/new")}
            >
              <Receipt className="mr-2 size-4" />
              Create invoice
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={CURRENT_PHASE < 2}
              onClick={() => router.push("/calendar")}
            >
              <CalendarPlus className="mr-2 size-4" />
              Book meeting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <NotificationPopover />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <UserIcon className="mr-2 size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Global search command palette */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BreadcrumbProvider } from "./breadcrumb-context";
import { BottomTabBar } from "./bottom-tab-bar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

interface AppShellProps {
  children: React.ReactNode;
  userEmail: string;
}

export function AppShell({ children, userEmail }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <BreadcrumbProvider>
      <div className="flex h-svh overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <Sidebar />
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar
            onMenuClick={() => setMobileOpen(true)}
            userEmail={userEmail}
          />
          <main className="flex-1 overflow-y-auto px-6 pb-20 pt-6 lg:pb-6">
            <div className="mx-auto max-w-screen-xl">
              {children}
            </div>
          </main>
        </div>

        <BottomTabBar onMoreClick={() => setMobileOpen(true)} />
      </div>
    </BreadcrumbProvider>
  );
}

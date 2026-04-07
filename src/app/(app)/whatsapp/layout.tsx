"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWaUnread } from "@/hooks/use-wa-unread";

const TABS = [
  { label: "Chat", href: "/whatsapp/chat" },
  { label: "Campaigns", href: "/whatsapp/campaigns" },
  { label: "Templates", href: "/whatsapp/templates" },
];

export default function WhatsAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { count: waUnread } = useWaUnread();

  // Hide tabs on campaign detail/new pages
  const showTabs =
    pathname === "/whatsapp/campaigns" ||
    pathname === "/whatsapp/templates" ||
    pathname.startsWith("/whatsapp/chat");

  // Hide layout chrome on full-page editors
  if (pathname === "/whatsapp/templates/new") {
    return <>{children}</>;
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Campaigns, templates, and messaging.
        </p>
      </div>

      {showTabs && (
        <div className="flex gap-1 border-b">
          {TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {tab.href === "/whatsapp/chat" && waUnread > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                    {waUnread > 99 ? "99+" : waUnread}
                  </span>
                )}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      )}

      {children}
    </div>
  );
}

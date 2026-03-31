"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Campaigns", href: "/whatsapp" },
  { label: "Templates", href: "/whatsapp/templates" },
];

export default function WhatsAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Hide tabs on campaign detail/new pages
  const showTabs =
    pathname === "/whatsapp" || pathname === "/whatsapp/templates";

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
            const isActive =
              tab.href === "/whatsapp"
                ? pathname === "/whatsapp"
                : pathname.startsWith(tab.href);
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

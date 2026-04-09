"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Campaigns", href: "/email" },
  { label: "Templates", href: "/email/templates" },
];

export default function EmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Hide header + tabs on editor pages (new/edit)
  const isEditorPage =
    pathname === "/email/templates/new" || pathname.endsWith("/edit");
  const showTabs =
    pathname === "/email" || pathname === "/email/templates";

  if (isEditorPage) {
    return <>{children}</>;
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Email</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Campaigns, templates, and messaging.
        </p>
      </div>

      {showTabs && (
        <div className="flex gap-1 border-b">
          {TABS.map((tab) => {
            const isActive =
              tab.href === "/email"
                ? pathname === "/email"
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

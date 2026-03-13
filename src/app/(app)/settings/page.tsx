"use client";

import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Monitor,
  Puzzle,
  ChevronRight,
  Building2,
  Users,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const SETTINGS_LINKS = [
  {
    href: "/settings/profile",
    icon: Building2,
    title: "Business Profile",
    description: "Company name, GST, address, and logo.",
  },
  {
    href: "/settings/team",
    icon: Users,
    title: "Team Management",
    description: "Manage team members and roles.",
  },
  {
    href: "/settings/integrations",
    icon: Puzzle,
    title: "Integrations",
    description: "Connect Google Calendar and other services.",
  },
  {
    href: "/settings/notifications",
    icon: Bell,
    title: "Notifications",
    description: "Configure notification preferences.",
  },
] as const;

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Account and application settings.
        </p>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose your preferred color theme.
        </p>
        <div className="mt-4 flex gap-3">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border px-5 py-3 text-sm transition-colors",
                theme === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings sub-sections */}
      {SETTINGS_LINKS.map(({ href, icon: Icon, title, description }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center justify-between rounded-xl border bg-card p-6 transition-colors hover:bg-accent/50"
        >
          <div className="flex items-center gap-3">
            <Icon className="size-5 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}

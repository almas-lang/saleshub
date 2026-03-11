"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Puzzle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
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

      {/* Integrations */}
      <Link
        href="/settings/integrations"
        className="flex items-center justify-between rounded-xl border bg-card p-6 transition-colors hover:bg-accent/50"
      >
        <div className="flex items-center gap-3">
          <Puzzle className="size-5 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">Integrations</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Connect Google Calendar and other services.
            </p>
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </div>
  );
}

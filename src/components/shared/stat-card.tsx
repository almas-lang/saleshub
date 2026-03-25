"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";

interface StatCardProps {
  label: string;
  value: number;
  format?: "currency" | "number" | "percent";
  suffix?: string;
  danger?: boolean;
  color?: "emerald" | "red" | "amber" | "blue" | "default";
  index?: number;
  children?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  format: fmt = "currency",
  suffix,
  danger,
  color = "default",
  index = 0,
  children,
}: StatCardProps) {
  const animated = useCountUp(value);
  const isZero = value === 0;

  const colorClass =
    color === "emerald"
      ? "text-emerald-600"
      : color === "red"
        ? "text-red-500"
        : color === "amber"
          ? "text-amber-600"
          : color === "blue"
            ? "text-blue-600"
            : danger && !isZero
              ? "text-destructive"
              : isZero
                ? "text-muted-foreground"
                : "text-foreground";

  const displayValue =
    fmt === "currency"
      ? formatCurrency(animated)
      : fmt === "percent"
        ? `${animated.toFixed ? animated.toFixed(1) : animated}%`
        : animated.toLocaleString();

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 transition-shadow duration-[180ms]",
        "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)]",
        "hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06),0_2px_4px_-1px_rgba(0,0,0,0.04)]",
        danger && "border-l-[3px] border-l-destructive"
      )}
      style={{
        animation: `fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both`,
      }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-2xl tracking-tight",
          isZero ? "font-normal" : "font-bold",
          colorClass
        )}
      >
        {displayValue}
        {suffix && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
      {children}
    </div>
  );
}

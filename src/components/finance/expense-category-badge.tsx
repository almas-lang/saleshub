"use client";

import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  "Advertising": "#EF4444",
  "Software & Tools": "#3B82F6",
  "Freelancers & Contractors": "#8B5CF6",
  "Content Production": "#F59E0B",
  "Office & Supplies": "#6B7280",
  "Travel & Events": "#14B8A6",
  "Communication (Phone/Internet)": "#06B6D4",
  "Training & Education": "#EC4899",
  "Taxes & Compliance": "#84CC16",
  "Miscellaneous": "#9CA3AF",
};

interface ExpenseCategoryBadgeProps {
  category: string;
  className?: string;
}

export function ExpenseCategoryBadge({ category, className }: ExpenseCategoryBadgeProps) {
  const color = CATEGORY_COLORS[category] ?? "#6B7280";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{ backgroundColor: `${color}15`, color }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {category}
    </span>
  );
}

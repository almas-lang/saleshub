import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted ring-1 ring-border/50">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
      {action && (
        <Button className="mt-3" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

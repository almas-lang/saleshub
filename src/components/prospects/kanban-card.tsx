"use client";

import { useCallback, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { Phone, AlertCircle, ArrowRightLeft } from "lucide-react";
import { cn, timeAgo, formatPhone } from "@/lib/utils";
import type { ContactWithStage } from "@/types/contacts";

interface KanbanCardProps {
  contact: ContactWithStage;
  lastActivity: string | undefined;
  stageColor: string;
  /** When true, renders as a static overlay card (no drag hooks). */
  isOverlay?: boolean;
  /** Brief pulse animation after a successful drop. */
  justDropped?: boolean;
  /** Mobile: callback to open stage-picker sheet. Disables drag when set. */
  onMovePress?: () => void;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const LONG_PRESS_MS = 500;

function getUrgencyBorderColor(
  lastActivity: string | undefined,
  stageColor: string
) {
  if (!lastActivity) return "var(--destructive, #D94F4F)";
  const elapsed = Date.now() - new Date(lastActivity).getTime();
  if (elapsed > SEVEN_DAYS_MS) return "var(--destructive, #D94F4F)";
  if (elapsed > THREE_DAYS_MS) return "var(--warning, #E59A0B)";
  return stageColor;
}

function getActivityTimeColor(lastActivity: string | undefined) {
  if (!lastActivity) return "text-destructive";
  const elapsed = Date.now() - new Date(lastActivity).getTime();
  if (elapsed > SEVEN_DAYS_MS) return "text-destructive";
  if (elapsed > THREE_DAYS_MS) return "text-amber-500";
  return "text-muted-foreground";
}

function getInitials(first: string, last: string | null | undefined) {
  const f = first?.[0] ?? "";
  const l = last?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

export function KanbanCard({
  contact,
  lastActivity,
  stageColor,
  isOverlay = false,
  justDropped = false,
  onMovePress,
}: KanbanCardProps) {
  const router = useRouter();

  // Disable drag when in mobile move mode or overlay
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: contact.id,
    disabled: isOverlay || !!onMovePress,
  });

  const borderColor = getUrgencyBorderColor(lastActivity, stageColor);
  const isUrgent =
    !lastActivity ||
    Date.now() - new Date(lastActivity).getTime() > THREE_DAYS_MS;

  const waLink = contact.phone
    ? `https://wa.me/${contact.phone.replace(/\D/g, "")}`
    : null;

  // ── Long-press handling (mobile only, when onMovePress is set) ──
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressFired = useRef(false);

  const handleTouchStart = useCallback(() => {
    if (!onMovePress) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onMovePress();
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_MS);
  }, [onMovePress]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      clearTimeout(longPressTimer.current);
      if (longPressFired.current) {
        e.preventDefault();
      }
    },
    []
  );

  const handleTouchMove = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const handleClick = useCallback(() => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (!isDragging && !isOverlay) {
      router.push(`/prospects/${contact.id}`);
    }
  }, [isDragging, isOverlay, router, contact.id]);

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      {...(isOverlay || onMovePress ? {} : listeners)}
      {...(isOverlay || onMovePress ? {} : attributes)}
      style={{ borderLeftColor: borderColor }}
      className={cn(
        "group w-full cursor-grab rounded-xl border border-l-[3px] bg-card p-3.5",
        // Normal state
        !isDragging &&
          !isOverlay &&
          "shadow-sm transition-all duration-150 hover:bg-accent/30 hover:shadow-md",
        // Ghost while dragging
        isDragging && "pointer-events-none opacity-30",
        // Overlay: lifted look
        isOverlay &&
          "scale-[1.03] rotate-[1.5deg] shadow-xl ring-1 ring-primary/20",
        // Drop splash
        justDropped && "animate-drop-splash",
        // Mobile: normal pointer cursor
        onMovePress && "cursor-default"
      )}
      onClick={handleClick}
      onTouchStart={onMovePress ? handleTouchStart : undefined}
      onTouchEnd={onMovePress ? handleTouchEnd : undefined}
      onTouchMove={onMovePress ? handleTouchMove : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {getInitials(contact.first_name, contact.last_name)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug">
            {contact.first_name} {contact.last_name ?? ""}
          </p>

          {contact.phone && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
              <Phone className="size-3 shrink-0" />
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate transition-colors hover:text-foreground hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {formatPhone(contact.phone)}
                </a>
              ) : (
                <span className="truncate">{formatPhone(contact.phone)}</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Footer: activity time + urgency + move button */}
      <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2">
        <span
          suppressHydrationWarning
          className={cn(
            "text-[11px] leading-none",
            getActivityTimeColor(lastActivity)
          )}
        >
          {lastActivity ? timeAgo(lastActivity) : "No activity"}
        </span>

        <div className="flex items-center gap-1.5">
          {isUrgent && (
            <AlertCircle className="size-3.5 text-destructive/70" />
          )}
          {onMovePress && (
            <button
              aria-label="Move to stage"
              onClick={(e) => {
                e.stopPropagation();
                onMovePress();
              }}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent"
            >
              <ArrowRightLeft className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

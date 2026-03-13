"use client";

import { useState } from "react";
import {
  Phone,
  MessageSquare,
  StickyNote,
  Bell,
  Pencil,
  Trash2,
  Plus,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileFabProps {
  phone: string | null;
  onAddNote: () => void;
  onFollowUp: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSendWhatsApp?: () => void;
  onArchive?: () => void;
  isArchived?: boolean;
}

export function MobileFab({
  phone,
  onAddNote,
  onFollowUp,
  onEdit,
  onDelete,
  onSendWhatsApp,
  onArchive,
  isArchived,
}: MobileFabProps) {
  const [open, setOpen] = useState(false);

  function handleAction(action: () => void) {
    setOpen(false);
    action();
  }

  const actions = [
    ...(phone
      ? [
          {
            icon: Phone,
            label: "Call",
            href: `tel:${phone}`,
          },
          {
            icon: MessageSquare,
            label: "WhatsApp",
            onClick: () => handleAction(onSendWhatsApp ?? (() => {})),
          },
        ]
      : []),
    {
      icon: StickyNote,
      label: "Add Note",
      onClick: () => handleAction(onAddNote),
    },
    {
      icon: Bell,
      label: "Follow-up",
      onClick: () => handleAction(onFollowUp),
    },
    {
      icon: Pencil,
      label: "Edit",
      onClick: () => handleAction(onEdit),
    },
    ...(onArchive
      ? [
          {
            icon: isArchived ? ArchiveRestore : Archive,
            label: isArchived ? "Unarchive" : "Archive",
            onClick: () => handleAction(onArchive),
          },
        ]
      : []),
    {
      icon: Trash2,
      label: "Delete",
      onClick: () => handleAction(onDelete),
      destructive: true,
    },
  ];

  return (
    <>
      <button
        className="fixed bottom-20 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden active:scale-95 transition-transform"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Quick actions</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {actions.map((action) => {
              const Icon = action.icon;
              if ("href" in action && action.href) {
                return (
                  <a
                    key={action.label}
                    href={action.href}
                    target={
                      action.label === "WhatsApp" ? "_blank" : undefined
                    }
                    rel={
                      action.label === "WhatsApp"
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="flex flex-col items-center gap-2 rounded-xl p-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <Icon className="size-5" />
                    <span className="text-xs font-medium">{action.label}</span>
                  </a>
                );
              }
              return (
                <button
                  key={action.label}
                  className={`flex flex-col items-center gap-2 rounded-xl p-3 transition-colors ${
                    "destructive" in action && action.destructive
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={"onClick" in action ? action.onClick : undefined}
                >
                  <Icon className="size-5" />
                  <span className="text-xs font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

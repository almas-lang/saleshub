"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, ArrowLeft, Loader2, Check } from "lucide-react";
import { safeFetch } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WATemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  text?: string;
}

interface WATemplate {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  components: WATemplateComponent[];
}

interface SendWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactFirstName: string;
  contactPhone: string;
}

export function SendWhatsAppDialog({
  open,
  onOpenChange,
  contactId,
  contactFirstName,
  contactPhone,
}: SendWhatsAppDialogProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WATemplate | null>(null);
  const [sending, setSending] = useState(false);

  // Reset state and fetch templates when dialog opens
  useEffect(() => {
    if (!open) return;

    const run = async () => {
      setSelected(null);
      setError(null);
      setLoading(true);

      const result = await safeFetch<{ templates: WATemplate[] }>("/api/whatsapp/templates");
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Only show approved templates
      const approved = result.data.templates.filter(
        (t) => t.status === "APPROVED"
      );
      setTemplates(approved);
    };
    run();
  }, [open]);

  function getBodyText(template: WATemplate): string {
    const bodyComp = template.components.find((c) => c.type === "BODY");
    return bodyComp?.text ?? "";
  }

  function getPreviewText(template: WATemplate): string {
    const body = getBodyText(template);
    // Replace {{1}} with contact name, leave others as-is
    return body.replace(/\{\{1\}\}/g, contactFirstName);
  }

  const handleSend = useCallback(async () => {
    if (!selected) return;
    setSending(true);

    const bodyText = getBodyText(selected);
    // Check if template has body parameters
    const hasParams = /\{\{1\}\}/.test(bodyText);

    const result = await safeFetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: contactId,
        template_name: selected.name,
        params: hasParams ? [contactFirstName] : [],
        language: selected.language,
      }),
    });

    setSending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`WhatsApp sent to ${contactFirstName}`);
    onOpenChange(false);
    router.refresh();
  }, [selected, contactId, contactFirstName, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selected ? (
              <button
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className="size-3.5" />
                Back to templates
              </button>
            ) : (
              `Send WhatsApp to ${contactFirstName}`
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Template picker */}
        {!selected && (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {error && (
              <p className="py-6 text-center text-sm text-destructive">
                {error}
              </p>
            )}
            {!loading && !error && templates.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No approved templates found
              </p>
            )}
            {templates.map((t) => {
              const body = getBodyText(t);
              return (
                <button
                  key={t.id}
                  className="w-full rounded-lg border p-3 text-left hover:bg-muted transition-colors"
                  onClick={() => setSelected(t)}
                >
                  <p className="text-sm font-medium">{t.name.replace(/_/g, " ")}</p>
                  {body && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {body}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Preview */}
        {selected && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Preview
              </p>
              <p className="whitespace-pre-wrap text-sm">
                {getPreviewText(selected)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Sending to {contactPhone}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {selected && (
            <Button
              size="sm"
              disabled={sending}
              onClick={handleSend}
              className={cn(
                "gap-1.5",
                sending && "opacity-70"
              )}
            >
              {sending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Send
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

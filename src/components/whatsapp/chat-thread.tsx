"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  MessageSquare,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  FileText,
  Video,
  Mic,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { playNotificationSound } from "@/lib/notification-sound";

// ── Types ──

interface WAMessage {
  id: string;
  contact_id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  message_type: string;
  wa_message_id: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Status Icon ──

function MessageStatus({ status }: { status: string | null }) {
  if (!status) return null;
  switch (status) {
    case "sent":
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case "read":
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case "failed":
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
}

function MediaTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "image":
      return <ImageIcon className="h-4 w-4" />;
    case "video":
      return <Video className="h-4 w-4" />;
    case "document":
      return <FileText className="h-4 w-4" />;
    case "audio":
      return <Mic className="h-4 w-4" />;
    default:
      return null;
  }
}

// ── Message Bubble ──

function MessageBubble({ msg }: { msg: WAMessage }) {
  const isOutbound = msg.direction === "outbound";
  const isMedia = msg.message_type !== "text" && msg.message_type !== "template";

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
          isOutbound
            ? "bg-emerald-600 text-white rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        {isMedia && (
          <div className="flex items-center gap-1.5 mb-1 opacity-80">
            <MediaTypeIcon type={msg.message_type} />
            <span className="text-xs capitalize">{msg.message_type}</span>
          </div>
        )}
        {msg.body ? (
          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        ) : isMedia ? (
          <p className="italic opacity-70">{msg.message_type} message</p>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-1 mt-1",
            isOutbound ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isOutbound ? "text-white/70" : "text-muted-foreground"
            )}
          >
            {new Date(msg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isOutbound && <MessageStatus status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

// ── Date Separator ──

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Separator className="flex-1" />
      <span className="text-[11px] font-medium text-muted-foreground">
        {new Date(date).toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

// ── Main Component ──

interface ChatThreadProps {
  contactId: string;
  /** Height of the container. Default: 500px */
  height?: string;
}

export function ChatThread({ contactId, height = "500px" }: ChatThreadProps) {
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevCountRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadMessages = useCallback(async () => {
    const result = await safeFetch<{
      messages: WAMessage[];
      contact: unknown;
    }>(`/api/whatsapp/conversations/${contactId}`);
    if (result.ok) {
      const newMsgs = result.data.messages;
      // Detect new inbound messages and play sound
      const inboundCount = newMsgs.filter((m) => m.direction === "inbound").length;
      if (
        prevCountRef.current > 0 &&
        inboundCount > prevCountRef.current
      ) {
        playNotificationSound();
        setTimeout(scrollToBottom, 100);
      }
      prevCountRef.current = inboundCount;

      setMessages(newMsgs);
      if (loading) setTimeout(scrollToBottom, 100);
    }
    setLoading(false);
  }, [contactId, loading, scrollToBottom]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  async function handleSend() {
    if (!replyText.trim() || sending) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText("");

    const result = await safeFetch<{ message: WAMessage }>(
      "/api/whatsapp/reply",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId, message: text }),
      }
    );

    if (!result.ok) {
      toast.error(result.error);
      setReplyText(text);
    } else {
      if (result.data.message) {
        setMessages((prev) => [...prev, result.data.message]);
      }
      setTimeout(scrollToBottom, 100);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  // Group messages by date
  const messageGroups: { date: string; messages: WAMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const date = new Date(msg.created_at).toDateString();
    if (date !== currentDate) {
      currentDate = date;
      messageGroups.push({ date: msg.created_at, messages: [msg] });
    } else {
      messageGroups[messageGroups.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex flex-col rounded-lg border" style={{ height }}>
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                No WhatsApp messages yet
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Send a template or receive a message to start
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messageGroups.map((group) => (
              <div key={group.date}>
                <DateSeparator date={group.date} />
                <div className="space-y-1.5">
                  {group.messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Reply composer */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Free-text replies work within 24h of the contact&apos;s last message.
        </p>
      </div>
    </div>
  );
}

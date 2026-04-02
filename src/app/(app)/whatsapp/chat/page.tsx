"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Search,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  FileText,
  Video,
  Mic,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo, formatPhone } from "@/lib/utils";
import { safeFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { playNotificationSound } from "@/lib/notification-sound";

// ── Types ──

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface Conversation {
  contact_id: string;
  last_message: string | null;
  last_message_direction: string;
  last_message_type: string;
  last_message_at: string;
  contact: Contact;
  unread_count: number;
}

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
    <div
      className={cn(
        "flex",
        isOutbound ? "justify-end" : "justify-start"
      )}
    >
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
          <p className="italic opacity-70">
            {msg.message_type} message
          </p>
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

// ── Conversation List Item ──

function ConversationItem({
  conv,
  isActive,
  onClick,
}: {
  conv: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const contactName = conv.contact
    ? `${conv.contact.first_name} ${conv.contact.last_name ?? ""}`.trim()
    : null;
  const phone = conv.contact?.phone ?? null;
  const name = contactName || phone || "Unknown";

  const initials = contactName
    ? `${conv.contact!.first_name?.[0] ?? ""}${conv.contact!.last_name?.[0] ?? ""}`.toUpperCase()
    : phone ? "#" : "?";

  const preview =
    conv.last_message_type !== "text" && conv.last_message_type !== "template"
      ? `[${conv.last_message_type}]`
      : conv.last_message ?? "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
        isActive && "bg-muted"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {timeAgo(conv.last_message_at)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {conv.last_message_direction === "outbound" && (
            <span className="mr-1">You:</span>
          )}
          {preview || "No messages"}
        </p>
      </div>
    </button>
  );
}

// ── Main Page ──

export default function WhatsAppChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeContactId = searchParams.get("contact");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevInboundCountRef = useRef(0);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    const result = await safeFetch<Conversation[]>(
      "/api/whatsapp/conversations"
    );
    if (result.ok) {
      setConversations(result.data);
    }
    setLoading(false);
  }, []);

  // Load messages for active contact
  const loadMessages = useCallback(
    async (contactId: string) => {
      setMessagesLoading(true);
      const result = await safeFetch<{
        messages: WAMessage[];
        contact: Contact;
      }>(`/api/whatsapp/conversations/${contactId}`);
      if (result.ok) {
        const newMsgs = result.data.messages;
        // Detect new inbound messages and play sound
        const inboundCount = newMsgs.filter((m) => m.direction === "inbound").length;
        if (prevInboundCountRef.current > 0 && inboundCount > prevInboundCountRef.current) {
          playNotificationSound();
        }
        prevInboundCountRef.current = inboundCount;

        setMessages(newMsgs);
        setActiveContact(result.data.contact);
        setTimeout(scrollToBottom, 100);
      }
      setMessagesLoading(false);
    },
    [scrollToBottom]
  );

  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (activeContactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on param change
      loadMessages(activeContactId);
      // Mark WA notifications as read for this contact
      safeFetch("/api/whatsapp/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: activeContactId }),
      });
    } else {
      setMessages([]);
      setActiveContact(null);
    }
  }, [activeContactId, loadMessages]);

  // Poll for new messages every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (activeContactId) {
        loadMessages(activeContactId);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeContactId, loadConversations, loadMessages]);

  // Send reply
  async function handleSend() {
    if (!replyText.trim() || !activeContactId || sending) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText("");

    const result = await safeFetch<{ message: WAMessage }>(
      "/api/whatsapp/reply",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: activeContactId,
          message: text,
        }),
      }
    );

    if (!result.ok) {
      toast.error(result.error);
      setReplyText(text); // restore on failure
    } else {
      // Append the new message immediately
      if (result.data.message) {
        setMessages((prev) => [...prev, result.data.message]);
      }
      setTimeout(scrollToBottom, 100);
      loadConversations(); // refresh sidebar
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function selectConversation(contactId: string) {
    router.push(`/whatsapp/chat?contact=${contactId}`);
  }

  // Filter conversations by search
  const filtered = searchQuery
    ? conversations.filter((c) => {
        const name =
          `${c.contact?.first_name ?? ""} ${c.contact?.last_name ?? ""}`.toLowerCase();
        const phone = c.contact?.phone ?? "";
        return (
          name.includes(searchQuery.toLowerCase()) ||
          phone.includes(searchQuery)
        );
      })
    : conversations;

  // Group messages by date
  function groupMessagesByDate(msgs: WAMessage[]) {
    const groups: { date: string; messages: WAMessage[] }[] = [];
    let currentDate = "";

    for (const msg of msgs) {
      const date = new Date(msg.created_at).toDateString();
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date: msg.created_at, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex h-[calc(100vh-10rem)] overflow-hidden rounded-lg border bg-background">
      {/* ── Left: Conversation list ── */}
      <div
        className={cn(
          "w-full sm:w-80 lg:w-96 border-r flex flex-col shrink-0",
          activeContactId && "hidden sm:flex"
        )}
      >
        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery
                  ? "No conversations match your search"
                  : "No WhatsApp conversations yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Send a template or receive a message to start
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((conv) => (
                <ConversationItem
                  key={conv.contact_id}
                  conv={conv}
                  isActive={conv.contact_id === activeContactId}
                  onClick={() => selectConversation(conv.contact_id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right: Chat thread ── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
          !activeContactId && "hidden sm:flex"
        )}
      >
        {!activeContactId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                Select a conversation to start chatting
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-8 w-8"
                onClick={() => router.push("/whatsapp/chat")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {activeContact && (
                <>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
                    {`${activeContact.first_name?.[0] ?? ""}${activeContact.last_name?.[0] ?? ""}`.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {activeContact.first_name}{" "}
                      {activeContact.last_name ?? ""}
                    </p>
                    {activeContact.phone && (
                      <p className="text-xs text-muted-foreground">
                        {formatPhone(activeContact.phone)}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/prospects/${activeContact.id}`}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    View profile
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </>
              )}
            </div>

            {/* Messages area */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    Loading messages...
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No messages yet
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
                  placeholder="Type a message... (24h window required)"
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
                Free-text replies only work within 24h of the contact&apos;s last message.
                Outside this window, use a template.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

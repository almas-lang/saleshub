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
  MoreVertical,
  Trash2,
  Archive,
  ArchiveRestore,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo, formatPhone } from "@/lib/utils";
import { safeFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { playNotificationSound } from "@/lib/notification-sound";

// ── Types ──

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
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

function MessageBubble({
  msg,
  onDelete,
}: {
  msg: WAMessage;
  onDelete: (id: string) => void;
}) {
  const isOutbound = msg.direction === "outbound";
  const isMedia = msg.message_type !== "text" && msg.message_type !== "template";

  return (
    <div
      className={cn("group flex", isOutbound ? "justify-end" : "justify-start")}
    >
      {/* Delete menu — left side for outbound, right side for inbound */}
      {!isOutbound && (
        <div className="flex items-start">
          <MessageContent msg={msg} isOutbound={isOutbound} isMedia={isMedia} />
          <MessageActions msgId={msg.id} onDelete={onDelete} />
        </div>
      )}
      {isOutbound && (
        <div className="flex items-start">
          <MessageActions msgId={msg.id} onDelete={onDelete} />
          <MessageContent msg={msg} isOutbound={isOutbound} isMedia={isMedia} />
        </div>
      )}
    </div>
  );
}

function MessageContent({
  msg,
  isOutbound,
  isMedia,
}: {
  msg: WAMessage;
  isOutbound: boolean;
  isMedia: boolean;
}) {
  return (
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
  );
}

function MessageActions({
  msgId,
  onDelete,
}: {
  msgId: string;
  onDelete: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted/50 self-center">
          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(msgId)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  onArchive,
  isArchived,
}: {
  conv: Conversation;
  isActive: boolean;
  onClick: () => void;
  onArchive: (contactId: string, archive: boolean) => void;
  isArchived: boolean;
}) {
  const contactName = conv.contact
    ? `${conv.contact.first_name} ${conv.contact.last_name ?? ""}`.trim()
    : null;
  const phone = conv.contact?.phone ?? null;
  const name = contactName || phone || "Unknown";

  const initials = contactName
    ? `${conv.contact!.first_name?.[0] ?? ""}${conv.contact!.last_name?.[0] ?? ""}`.toUpperCase()
    : phone
      ? "#"
      : "?";

  const preview =
    conv.last_message_type !== "text" && conv.last_message_type !== "template"
      ? `[${conv.last_message_type}]`
      : conv.last_message ?? "";

  return (
    <div
      className={cn(
        "group/conv flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer",
        isActive && "bg-muted"
      )}
    >
      <button onClick={onClick} className="flex items-start gap-3 flex-1 min-w-0 text-left">
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="opacity-0 group-hover/conv:opacity-100 transition-opacity p-1 rounded hover:bg-muted self-center shrink-0">
            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onArchive(conv.contact_id, !isArchived);
            }}
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                Unarchive
              </>
            ) : (
              <>
                <Archive className="mr-2 h-3.5 w-3.5" />
                Archive
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Image Preview Strip ──

function ImagePreview({
  file,
  onClear,
}: {
  file: File;
  onClear: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t bg-muted/30">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Preview"
          className="h-12 w-12 rounded object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {(file.size / 1024).toFixed(0)} KB
        </p>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClear}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
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
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevInboundCountRef = useRef(0);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    const url = showArchived
      ? "/api/whatsapp/conversations?archived=true"
      : "/api/whatsapp/conversations";
    const result = await safeFetch<Conversation[]>(url);
    if (result.ok) {
      setConversations(result.data);
    }
    setLoading(false);
  }, [showArchived]);

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
        const inboundCount = newMsgs.filter(
          (m) => m.direction === "inbound"
        ).length;
        if (
          prevInboundCountRef.current > 0 &&
          inboundCount > prevInboundCountRef.current
        ) {
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
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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

  // Delete message
  async function handleDeleteMessage() {
    if (!deleteTarget) return;
    const result = await safeFetch(`/api/whatsapp/messages/${deleteTarget}`, {
      method: "DELETE",
    });
    if (result.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== deleteTarget));
      toast.success("Message deleted");
    } else {
      toast.error("Failed to delete message");
    }
    setDeleteTarget(null);
  }

  // Archive/unarchive conversation
  async function handleArchive(contactId: string, archive: boolean) {
    const result = await safeFetch(
      `/api/whatsapp/conversations/${contactId}/archive`,
      { method: archive ? "POST" : "DELETE" }
    );
    if (result.ok) {
      setConversations((prev) =>
        prev.filter((c) => c.contact_id !== contactId)
      );
      toast.success(archive ? "Chat archived" : "Chat unarchived");
      if (contactId === activeContactId) {
        router.push("/whatsapp/chat");
      }
    } else {
      toast.error("Failed to update chat");
    }
  }

  // Send reply (text or image)
  async function handleSend() {
    if ((!replyText.trim() && !selectedImage) || !activeContactId || sending)
      return;
    setSending(true);
    const text = replyText.trim();
    setReplyText("");

    if (selectedImage) {
      // Send image
      const formData = new FormData();
      formData.append("contact_id", activeContactId);
      formData.append("file", selectedImage);
      if (text) formData.append("caption", text);

      const result = await safeFetch<{ message: WAMessage }>(
        "/api/whatsapp/send-image",
        { method: "POST", body: formData }
      );

      if (!result.ok) {
        toast.error(result.error);
        setReplyText(text);
      } else {
        if (result.data.message) {
          setMessages((prev) => [...prev, result.data.message]);
        }
        setTimeout(scrollToBottom, 100);
        loadConversations();
      }
      setSelectedImage(null);
    } else {
      // Send text
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
        setReplyText(text);
      } else {
        if (result.data.message) {
          setMessages((prev) => [...prev, result.data.message]);
        }
        setTimeout(scrollToBottom, 100);
        loadConversations();
      }
    }
    setSending(false);
    inputRef.current?.focus();
  }

  // Handle file selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setSelectedImage(file);
    // Reset the input so re-selecting the same file triggers onChange
    e.target.value = "";
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
          "w-full sm:w-80 lg:w-96 border-r flex flex-col shrink-0 overflow-hidden",
          activeContactId && "hidden sm:flex"
        )}
      >
        {/* Tabs: Chat / Archived */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setShowArchived(false)}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
              !showArchived
                ? "text-foreground border-b-2 border-emerald-600"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Chat
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
              showArchived
                ? "text-foreground border-b-2 border-emerald-600"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Archive className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            Archived
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b shrink-0">
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
                  : showArchived
                    ? "No archived conversations"
                    : "No WhatsApp conversations yet"}
              </p>
              {!searchQuery && !showArchived && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Send a template or receive a message to start
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((conv) => (
                <ConversationItem
                  key={conv.contact_id}
                  conv={conv}
                  isActive={conv.contact_id === activeContactId}
                  onClick={() => selectConversation(conv.contact_id)}
                  onArchive={handleArchive}
                  isArchived={showArchived}
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
                          <MessageBubble
                            key={msg.id}
                            msg={msg}
                            onDelete={setDeleteTarget}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Image preview */}
            {selectedImage && (
              <ImagePreview
                file={selectedImage}
                onClear={() => setSelectedImage(null)}
              />
            )}

            {/* Reply composer */}
            <div className="border-t p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                >
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Input
                  ref={inputRef}
                  placeholder={
                    selectedImage
                      ? "Add a caption... (optional)"
                      : "Type a message... (24h window required)"
                  }
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
                  disabled={(!replyText.trim() && !selectedImage) || sending}
                  className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Free-text replies only work within 24h of the contact&apos;s
                last message. Outside this window, use a template.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete message?"
        description="This message will be removed from your inbox. This cannot be undone."
        onConfirm={handleDeleteMessage}
        destructive
      />
    </div>
  );
}

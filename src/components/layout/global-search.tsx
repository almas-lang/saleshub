"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ListChecks } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import { safeFetch } from "@/lib/fetch";
import { NAV_ITEMS, CURRENT_PHASE } from "@/lib/constants";
import type { ContactWithStage } from "@/types/contacts";

interface ContactsResponse {
  data: ContactWithStage[];
  total: number;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [contacts, setContacts] = useState<ContactWithStage[]>([]);
  const [searching, setSearching] = useState(false);

  // Reset query when dialog closes
  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) setQuery("");
      onOpenChange(value);
    },
    [onOpenChange]
  );

  // Fetch contacts when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) return;

    let cancelled = false;
    const run = async () => {
      setSearching(true);
      const result = await safeFetch<ContactsResponse>(
        `/api/contacts?search=${encodeURIComponent(debouncedQuery)}&per_page=5`
      );
      if (cancelled) return;
      if (result.ok) {
        setContacts(result.data.data);
      }
      setSearching(false);
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  function select(href: string) {
    router.push(href);
    onOpenChange(false);
  }

  // Filter pages by query for local matching
  const lowerQuery = query.toLowerCase();

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search contacts, pages..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Contacts from API */}
        {debouncedQuery.length >= 2 && (
          <CommandGroup heading="Contacts">
            {searching ? (
              <CommandItem disabled>Searching...</CommandItem>
            ) : contacts.length > 0 ? (
              contacts.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={`contact-${contact.id}`}
                  onSelect={() => select(`/prospects/${contact.id}`)}
                >
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {contact.email || contact.phone || "No contact info"}
                      </p>
                    </div>
                    {contact.funnel_stages && (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px]"
                        style={{
                          borderColor: contact.funnel_stages.color,
                          color: contact.funnel_stages.color,
                        }}
                      >
                        {contact.funnel_stages.name}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              ))
            ) : (
              <CommandItem disabled>No contacts found</CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem
            value="add-prospect"
            onSelect={() => select("/prospects?action=new")}
          >
            <UserPlus className="mr-2 size-4" />
            Add Prospect
          </CommandItem>
          <CommandItem
            value="create-task"
            onSelect={() => select("/tasks?action=new")}
          >
            <ListChecks className="mr-2 size-4" />
            Create Task
          </CommandItem>
        </CommandGroup>

        {/* Pages */}
        {NAV_ITEMS.map((group) => {
          const filtered = group.items.filter(
            (item) =>
              item.phase <= CURRENT_PHASE &&
              (!lowerQuery || item.name.toLowerCase().includes(lowerQuery))
          );
          if (filtered.length === 0) return null;
          return (
            <CommandGroup key={group.group} heading={group.group}>
              {filtered.map((item) => (
                <CommandItem
                  key={item.name}
                  value={`page-${item.name}`}
                  onSelect={() => select(item.href)}
                >
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        <CommandGroup heading="Other">
          {(!lowerQuery || "settings".includes(lowerQuery)) && (
            <CommandItem value="page-settings" onSelect={() => select("/settings")}>
              Settings
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

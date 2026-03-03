"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TagsCardProps {
  contactId: string;
  tags: string[];
}

export function TagsCard({ contactId, tags }: TagsCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  async function updateTags(updatedTags: string[]) {
    setSaving(true);
    const result = await safeFetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: updatedTags }),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  function handleAddTag() {
    const tag = newTag.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      setNewTag("");
      return;
    }
    updateTags([...tags, tag]);
    setNewTag("");
  }

  function handleRemoveTag(tag: string) {
    updateTags(tags.filter((t) => t !== tag));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Tags</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Done" : "Edit"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {tags.length === 0 && !editing && (
            <p className="text-sm text-muted-foreground">No tags</p>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
              {editing && (
                <button
                  className="ml-0.5 hover:text-foreground transition-colors"
                  onClick={() => handleRemoveTag(tag)}
                  disabled={saving}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        {editing && (
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Add tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={handleAddTag}
              disabled={!newTag.trim() || saving}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

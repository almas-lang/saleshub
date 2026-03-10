"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { useCallback, useState } from "react";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  LinkIcon,
  ImageIcon,
  Minus,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { EmailVariableMenu } from "./email-variable-menu";
import { cn } from "@/lib/utils";

interface EmailBlockEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function EmailBlockEditor({
  content,
  onChange,
  placeholder = "Start writing your email...",
}: EmailBlockEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[400px] px-4 py-3 focus:outline-none",
      },
    },
  });

  const insertVariable = useCallback(
    (variable: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(`{{${variable}}}`).run();
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div className="rounded-md border bg-card">
      <Toolbar editor={editor} onInsertVariable={insertVariable} />
      <EditorContent editor={editor} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toolbar                                                            */
/* ------------------------------------------------------------------ */

function Toolbar({
  editor,
  onInsertVariable,
}: {
  editor: ReturnType<typeof useEditor> & {};
  onInsertVariable: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
      {/* Text formatting */}
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <UnderlineIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>

      <Sep />

      {/* Headings */}
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        title="Heading 1"
      >
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        title="Heading 2"
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        title="Heading 3"
      >
        <Heading3 className="size-4" />
      </ToolbarButton>

      <Sep />

      {/* Alignment */}
      <ToolbarButton
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        title="Align left"
      >
        <AlignLeft className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        title="Align center"
      >
        <AlignCenter className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        title="Align right"
      >
        <AlignRight className="size-4" />
      </ToolbarButton>

      <Sep />

      {/* Lists */}
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>

      <Sep />

      {/* Link */}
      <LinkPopover editor={editor} />

      {/* Image */}
      <ImagePopover editor={editor} />

      {/* Divider */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Insert divider"
      >
        <Minus className="size-4" />
      </ToolbarButton>

      {/* Variable */}
      <EmailVariableMenu onInsert={onInsertVariable} />

      <Sep />

      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo2 className="size-4" />
      </ToolbarButton>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function ToolbarButton({
  active,
  disabled,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { active?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      className={cn(active && "bg-accent text-accent-foreground")}
      disabled={disabled}
      {...props}
    >
      {children}
    </Button>
  );
}

function Sep() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

/* ------------------------------------------------------------------ */
/*  Link popover                                                       */
/* ------------------------------------------------------------------ */

function LinkPopover({
  editor,
}: {
  editor: ReturnType<typeof useEditor> & {};
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const apply = () => {
    if (url) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setOpen(false);
    setUrl("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setUrl(editor.getAttributes("link").href ?? "");
        }
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <ToolbarButton active={editor.isActive("link")} title="Insert link">
          <LinkIcon className="size-4" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 gap-2 p-2" align="start">
        <Input
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={apply} type="button">
          Apply
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/*  Image popover                                                      */
/* ------------------------------------------------------------------ */

function ImagePopover({
  editor,
}: {
  editor: ReturnType<typeof useEditor> & {};
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const insert = () => {
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
    setOpen(false);
    setUrl("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton title="Insert image">
          <ImageIcon className="size-4" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 gap-2 p-2" align="start">
        <Input
          placeholder="Image URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && insert()}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={insert} type="button">
          Insert
        </Button>
      </PopoverContent>
    </Popover>
  );
}

"use client";

// 피드 Tiptap 편집기·보기. 설명과 댓글이 같이 쓴다. @로 사람을 멘션하고, Ctrl/Cmd+Enter로 보낸다(onSubmit).

import {
  EditorContent,
  Extension,
  type JSONContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { Bold, Code, Italic, List, ListOrdered } from "lucide-react";
import { useEffect, useRef } from "react";
import { useUserMap } from "@/shared/api/feed/lookups";
import { cn, tv } from "@/shared/lib/tw";
import { toolButton } from "@/shared/ui/button";
import { mentionExtension, starterKit } from "./extensions";
import { useMentionSuggestion } from "./mention-suggestion";

/** 읽기 전용 문서. 멘션은 지금 이름의 @칩으로 그린다 */
export function RichView({
  content,
  className,
}: {
  content: JSONContent;
  className?: string;
}) {
  const users = useUserMap();
  const editor = useEditor(
    {
      extensions: [starterKit, mentionExtension((id) => users.get(id)?.name)],
      content,
      editable: false,
      immediatelyRender: false,
      editorProps: { attributes: { class: "outline-none" } },
    },
    [content, users],
  );
  return (
    <EditorContent
      editor={editor}
      className={cn("text-ui leading-relaxed", className)}
    />
  );
}

const editorBox = tv({
  base: "rounded-md border border-line bg-elevated px-3 py-2 text-ui leading-relaxed outline-none focus:border-accent",
  variants: {
    size: { md: "min-h-28", sm: "min-h-16" },
    toolbar: { true: "rounded-t-none" },
  },
});

export function RichEditor({
  initial,
  onChange,
  label,
  autoFocus = false,
  onSubmit,
  toolbar = true,
  size = "md",
}: {
  initial: JSONContent | null;
  onChange: (doc: JSONContent) => void;
  label: string;
  autoFocus?: boolean;
  /** Ctrl/Cmd+Enter */
  onSubmit?: () => void;
  toolbar?: boolean;
  size?: "md" | "sm";
}) {
  const users = useUserMap();
  const usersRef = useRef(users);
  const submitRef = useRef(onSubmit);
  useEffect(() => {
    usersRef.current = users;
    submitRef.current = onSubmit;
  });
  const { suggestion, popup } = useMentionSuggestion();

  const editor = useEditor({
    extensions: [
      starterKit,
      mentionExtension((id) => usersRef.current.get(id)?.name, suggestion),
      Extension.create({
        name: "submitShortcut",
        addKeyboardShortcuts: () => ({
          "Mod-Enter": () => {
            submitRef.current?.();
            return !!submitRef.current;
          },
        }),
      }),
    ],
    content: initial ?? "",
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: editorBox({ size, toolbar }),
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        codeBlock: e.isActive("codeBlock"),
      },
  });

  const tools = [
    {
      key: "bold",
      label: "굵게",
      icon: Bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      key: "italic",
      label: "기울임",
      icon: Italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      key: "bulletList",
      label: "글머리 목록",
      icon: List,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      label: "번호 목록",
      icon: ListOrdered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "codeBlock",
      label: "코드 블록",
      icon: Code,
      run: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
  ] as const;

  return (
    <div className="flex min-w-0 flex-col">
      {toolbar && (
        <div
          role="toolbar"
          aria-label={`${label} 서식`}
          className="flex gap-1 rounded-t-md border border-b-0 border-line bg-panel p-1"
        >
          {tools.map((t) => (
            <button
              key={t.key}
              type="button"
              className={cn(toolButton(), "h-6.5 w-7")}
              aria-label={t.label}
              title={t.label}
              aria-pressed={active?.[t.key] ?? false}
              disabled={!editor}
              onClick={t.run}
            >
              <t.icon size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
      {popup}
    </div>
  );
}

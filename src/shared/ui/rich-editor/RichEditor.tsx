"use client";

// 피드 Tiptap 편집기·보기. 설명과 댓글이 같이 쓴다. @로 사람을 멘션하고, Ctrl/Cmd+Enter로 보낸다(onSubmit).

import { useLingui } from "@lingui/react/macro";
import {
  EditorContent,
  Extension,
  type JSONContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { Bold, Code, Italic, List, ListOrdered } from "lucide-react";
import { useUserMap } from "@/shared/api/feed/lookups";
import { cn, tv } from "@/shared/lib/tw";
import { useCallbackRef } from "@/shared/lib/use-callback-ref";
import { toolButton } from "@/shared/ui/button";
import { mentionExtension, starterKit } from "./extensions";
import { useMentionSuggestion } from "./mention-suggestion";
import "@/shared/config/messages";

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
  const { t } = useLingui();
  const users = useUserMap();
  // 편집기는 한 번만 만든다. 그 안에서 부르는 함수는 늘 지금 값을 읽는다.
  const nameOf = useCallbackRef((id: string) => users.get(id)?.name);
  const submit = useCallbackRef(() => {
    onSubmit?.();
    return !!onSubmit;
  });
  const { suggestion, popup } = useMentionSuggestion();

  const editor = useEditor({
    extensions: [
      starterKit,
      mentionExtension(nameOf, suggestion),
      Extension.create({
        name: "submitShortcut",
        addKeyboardShortcuts: () => ({
          "Mod-Enter": submit,
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
      label: t`굵게`,
      icon: Bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      key: "italic",
      label: t`기울임`,
      icon: Italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      key: "bulletList",
      label: t`글머리 목록`,
      icon: List,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      label: t`번호 목록`,
      icon: ListOrdered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "codeBlock",
      label: t`코드 블록`,
      icon: Code,
      run: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
  ] as const;

  return (
    <div className="flex min-w-0 flex-col">
      {toolbar && (
        <div
          role="toolbar"
          aria-label={t({
            message: `${label} 서식`,
            comment: "label은 편집기 이름 (설명, 댓글 등)",
          })}
          className="flex gap-1 rounded-t-md border border-b-0 border-line bg-panel p-1"
        >
          {tools.map((tool) => (
            <button
              key={tool.key}
              type="button"
              className={cn(toolButton(), "h-6.5 w-7")}
              aria-label={tool.label}
              title={tool.label}
              aria-pressed={active?.[tool.key] ?? false}
              disabled={!editor}
              onClick={tool.run}
            >
              <tool.icon size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
      {popup}
    </div>
  );
}

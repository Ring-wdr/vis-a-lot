"use client";

// 게시물 설명(Tiptap JSON). 상세는 읽기 전용으로 그리고, 편집·새 게시물 폼은 같은 확장으로 고친다.
// 자손 선택자를 쓰지 않으므로 노드마다 HTMLAttributes로 클래스를 직접 단다.

import type { JSONContent } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code, Italic, List, ListOrdered } from "lucide-react";
import { cn } from "@/shared/lib/tw";
import { toolButton } from "@/shared/ui/button";

const extensions = [
  StarterKit.configure({
    paragraph: { HTMLAttributes: { class: "my-1.5" } },
    heading: { HTMLAttributes: { class: "mt-3 mb-1.5 font-semibold" } },
    bulletList: { HTMLAttributes: { class: "my-1.5 list-disc pl-5" } },
    orderedList: { HTMLAttributes: { class: "my-1.5 list-decimal pl-5" } },
    blockquote: {
      HTMLAttributes: {
        class: "my-2 border-l-2 border-line pl-3 text-fg-secondary",
      },
    },
    code: {
      HTMLAttributes: { class: "rounded-xs bg-panel px-1 font-mono text-xs" },
    },
    codeBlock: {
      HTMLAttributes: {
        class: "my-2 overflow-x-auto rounded-md bg-panel p-3 font-mono text-xs",
      },
    },
    horizontalRule: { HTMLAttributes: { class: "my-3 border-line" } },
    link: {
      openOnClick: true,
      HTMLAttributes: { class: "text-accent underline" },
    },
  }),
];

/** 서버가 준 body를 Tiptap 문서로. 글자면 문단 하나로, 비었으면 null */
export function toDoc(body: unknown): JSONContent | null {
  if (body == null || body === "") return null;
  if (typeof body === "string")
    return {
      type: "doc",
      content: body.split(/\n/).map((line) => ({
        type: "paragraph",
        content: line ? [{ type: "text", text: line }] : [],
      })),
    };
  if (typeof body === "object" && (body as JSONContent).type === "doc")
    return body as JSONContent;
  return null;
}

/** 글자가 하나도 없는 문서 */
export function isEmptyDoc(doc: JSONContent | null | undefined): boolean {
  if (!doc) return true;
  const walk = (n: JSONContent): boolean =>
    !!n.text?.trim() || (n.content ?? []).some(walk);
  return !walk(doc);
}

/** 문서의 글자만 (AI 추천 입력) */
export function docText(doc: JSONContent | null | undefined): string {
  if (!doc) return "";
  if (doc.text) return doc.text;
  const sep = doc.type === "doc" ? "\n" : "";
  return (doc.content ?? []).map(docText).join(sep);
}

/** 읽기 전용 설명 */
export function RichTextView({ content }: { content: JSONContent }) {
  const editor = useEditor(
    {
      extensions,
      content,
      editable: false,
      immediatelyRender: false,
      editorProps: { attributes: { class: "outline-none" } },
    },
    [content],
  );
  return <EditorContent editor={editor} className="text-ui leading-relaxed" />;
}

/** 설명 편집기. 바뀔 때마다 onChange로 문서를 준다 */
export function RichTextEditor({
  initial,
  onChange,
  label,
  autoFocus = false,
}: {
  initial: JSONContent | null;
  onChange: (doc: JSONContent) => void;
  label: string;
  autoFocus?: boolean;
}) {
  const editor = useEditor({
    extensions,
    content: initial ?? "",
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class:
          "min-h-28 rounded-b-md border border-line bg-elevated px-3 py-2 text-ui leading-relaxed outline-none focus:border-accent",
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
    <div className="flex flex-col">
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
      <EditorContent editor={editor} />
    </div>
  );
}

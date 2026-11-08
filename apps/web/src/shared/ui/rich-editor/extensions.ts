// 피드 Tiptap 확장. 설명·댓글이 같은 노드 모양을 쓴다.
// 자손 선택자를 쓰지 않으므로 노드마다 HTMLAttributes로 클래스를 직접 단다.

import { Mention } from "@tiptap/extension-mention";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export const starterKit = StarterKit.configure({
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
});

/** 멘션 칩 */
const MENTION_CLASS =
  "rounded-sm bg-accent-soft px-1 font-medium whitespace-nowrap text-accent";

type MentionOptions = NonNullable<Parameters<typeof Mention.configure>[0]>;
/** @ 목록 설정 (Tiptap suggestion) */
export type MentionSuggestion = NonNullable<MentionOptions["suggestion"]>;

/**
 * 멘션 노드. 칩에는 지금 이름(nameOf)을 쓰고, 모르면 저장된 label을 쓴다.
 * suggestion을 주면 @로 사람을 고르는 목록이 뜬다 (./mention-suggestion.tsx).
 */
export function mentionExtension(
  nameOf: (id: string) => string | undefined,
  suggestion?: MentionSuggestion,
) {
  const label = (attrs: Record<string, unknown>) =>
    `@${nameOf(String(attrs.id)) ?? attrs.label ?? attrs.id}`;
  return Mention.configure({
    HTMLAttributes: { class: MENTION_CLASS },
    renderText: ({ node }) => label(node.attrs),
    renderHTML: ({ options, node }) => [
      "span",
      { ...options.HTMLAttributes, "data-type": "mention" },
      label(node.attrs),
    ],
    ...(suggestion ? { suggestion } : {}),
  });
}

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

/** 글자도 멘션도 없는 문서 */
export function isEmptyDoc(doc: JSONContent | null | undefined): boolean {
  if (!doc) return true;
  const walk = (n: JSONContent): boolean =>
    !!n.text?.trim() || n.type === "mention" || (n.content ?? []).some(walk);
  return !walk(doc);
}

/** 문서의 글자만 (AI 추천 입력). 멘션은 @이름으로 */
export function docText(doc: JSONContent | null | undefined): string {
  if (!doc) return "";
  if (doc.text) return doc.text;
  if (doc.type === "mention")
    return `@${doc.attrs?.label ?? doc.attrs?.id ?? ""}`;
  const sep = doc.type === "doc" ? "\n" : "";
  return (doc.content ?? []).map(docText).join(sep);
}

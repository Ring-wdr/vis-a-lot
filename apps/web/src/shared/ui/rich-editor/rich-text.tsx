"use client";

// 게시물 설명(Tiptap JSON). 상세는 읽기 전용으로 그리고, 편집·새 게시물 폼은 같은 확장으로 고친다.
// 편집기는 @멘션을 지원하는 피드 공용 편집기(src/shared/ui/rich-editor)를 쓴다.

import type { JSONContent } from "@tiptap/react";
import { RichEditor, RichView } from "./RichEditor";

export { docText, isEmptyDoc, toDoc } from "./extensions";

/** 읽기 전용 설명 */
export function RichTextView({ content }: { content: JSONContent }) {
  return <RichView content={content} />;
}

/** 설명 편집기. 바뀔 때마다 onChange로 문서를 준다 */
export function RichTextEditor(props: {
  initial: JSONContent | null;
  onChange: (doc: JSONContent) => void;
  label: string;
  autoFocus?: boolean;
}) {
  return <RichEditor {...props} />;
}

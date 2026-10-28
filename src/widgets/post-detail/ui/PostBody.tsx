"use client";

// 설명: 읽기 전용으로 그리고, 고칠 수 있으면 편집기로 바꿔 저장한다.

import type { JSONContent } from "@tiptap/react";
import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { usePostAction } from "@/entities/post/model/use-post-action";
import { detail } from "@/entities/post/ui/styles";
import { postsApi } from "@/shared/api/feed/posts";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";
import {
  isEmptyDoc,
  RichTextEditor,
  RichTextView,
  toDoc,
} from "@/shared/ui/rich-editor/rich-text";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";

const messages = defineMessages({
  ko: {
    title: "설명",
    edit: "편집",
    cancel: "취소",
    saveFailed: "설명을 저장하지 못했습니다",
    save: "저장",
    empty: "설명이 없습니다.",
  },
  en: {
    title: "Description",
    edit: "Edit",
    cancel: "Cancel",
    saveFailed: "Couldn't save the description",
    save: "Save",
    empty: "No description.",
  },
});

const d = detail();

export function PostBody({ post }: { post: PostDetail }) {
  const text = useT(messages);
  const doc = useMemo(() => toDoc(post.body), [post.body]);
  const [draft, setDraft] = useState<JSONContent | null>(null);
  const [editing, setEditing] = useState(false);
  const { run, pending } = usePostAction();

  return (
    <section className={d.section()} aria-labelledby="post-body-title">
      <div className={d.sectionHead()}>
        <h2 id="post-body-title" className={d.sectionTitle()}>
          {text.title}
        </h2>
        {post.permissions.edit && !editing && (
          <button
            type="button"
            className={button({ size: "sm" })}
            onClick={() => {
              setDraft(doc);
              setEditing(true);
            }}
          >
            <Pencil size={13} aria-hidden="true" />
            {text.edit}
          </button>
        )}
      </div>
      {editing ? (
        <>
          <RichTextEditor
            initial={doc}
            onChange={setDraft}
            label={text.title}
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              className={button({ size: "sm" })}
              disabled={!!pending}
              onClick={() => setEditing(false)}
            >
              {text.cancel}
            </button>
            <button
              type="button"
              className={button({ size: "sm", variant: "primary" })}
              disabled={!!pending}
              onClick={async () => {
                const body = isEmptyDoc(draft) ? null : draft;
                if (
                  await run("body", text.saveFailed, () =>
                    postsApi.update(post.id, { body }),
                  )
                )
                  setEditing(false);
              }}
            >
              {pending && <Spinner size="sm" tone="inherit" />}
              {text.save}
            </button>
          </div>
        </>
      ) : doc && !isEmptyDoc(doc) ? (
        <RichTextView content={doc} />
      ) : (
        <p className={d.hint()}>{text.empty}</p>
      )}
    </section>
  );
}

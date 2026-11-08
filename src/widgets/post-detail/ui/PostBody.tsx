"use client";

// 설명: 읽기 전용으로 그리고, 고칠 수 있으면 편집기로 바꿔 저장한다.

import { Trans, useLingui } from "@lingui/react/macro";
import type { JSONContent } from "@tiptap/react";
import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { usePostAction } from "@/entities/post/model/use-post-action";
import { detail } from "@/entities/post/ui/styles";
import { postsApi } from "@/shared/api/feed/posts";
import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";
import {
  isEmptyDoc,
  RichTextEditor,
  RichTextView,
  toDoc,
} from "@/shared/ui/rich-editor/rich-text";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";
import "../config/messages";

const d = detail();

export function PostBody({ post }: { post: PostDetail }) {
  const { t } = useLingui();
  const doc = useMemo(() => toDoc(post.body), [post.body]);
  const [draft, setDraft] = useState<JSONContent | null>(null);
  const [editing, setEditing] = useState(false);
  const { run, pending } = usePostAction();

  return (
    <section className={d.section()} aria-labelledby="post-body-title">
      <div className={d.sectionHead()}>
        <h2 id="post-body-title" className={d.sectionTitle()}>
          <Trans>설명</Trans>
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
            <Trans>편집</Trans>
          </button>
        )}
      </div>
      {editing ? (
        <>
          <RichTextEditor
            initial={doc}
            onChange={setDraft}
            label={t`설명`}
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              className={button({ size: "sm" })}
              disabled={!!pending}
              onClick={() => setEditing(false)}
            >
              <Trans context="cancel editing">취소</Trans>
            </button>
            <button
              type="button"
              className={button({ size: "sm", variant: "primary" })}
              disabled={!!pending}
              onClick={async () => {
                const body = isEmptyDoc(draft) ? null : draft;
                if (
                  await run("body", t`설명을 저장하지 못했습니다`, () =>
                    postsApi.update(post.id, { body }),
                  )
                )
                  setEditing(false);
              }}
            >
              {pending && <Spinner size="sm" tone="inherit" />}
              <Trans context="save edit">저장</Trans>
            </button>
          </div>
        </>
      ) : doc && !isEmptyDoc(doc) ? (
        <RichTextView content={doc} />
      ) : (
        <p className={d.hint()}>
          <Trans>설명이 없습니다.</Trans>
        </p>
      )}
    </section>
  );
}

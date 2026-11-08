"use client";

// 댓글 입력: @멘션 편집기, Ctrl/Cmd+Enter로 보내기, 첫 댓글에는 "투표 만들기"(질문 + 선택지 2~6개 + 마감).

import { ph } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { JSONContent } from "@tiptap/react";
import { ChartBar, Plus, X } from "lucide-react";
import { useState } from "react";
import { field } from "@/entities/post/ui/styles";
import { useCommentAction } from "@/features/comment-post/model/use-comment-action";
import { commentsApi } from "@/shared/api/feed/comments";
import { button, itemButton, linkButton } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";
import { RichEditor } from "@/shared/ui/rich-editor/RichEditor";
import { isEmptyDoc } from "@/shared/ui/rich-editor/rich-text";
import "../config/messages";

type PollDraft = { question: string; options: string[]; closesAt: string };

const emptyPoll = (): PollDraft => ({
  question: "",
  options: ["", ""],
  closesAt: "",
});

export function CommentComposer({
  postId,
  parentId,
  label,
  submitLabel,
  autoFocus = false,
  onDone,
}: {
  postId: string;
  /** 대댓글이면 스레드 첫 댓글 id */
  parentId?: string;
  label?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  /** 보낸 뒤나 취소 (대댓글 칸 닫기) */
  onDone?: () => void;
}) {
  const { t } = useLingui();
  const { run, pending } = useCommentAction();
  const [doc, setDoc] = useState<JSONContent | null>(null);
  // 보낸 뒤 편집기를 새로 만든다
  const [round, setRound] = useState(0);
  const [poll, setPoll] = useState<PollDraft | null>(null);

  const options = poll?.options.map((o) => o.trim()) ?? [];
  const pollReady =
    !!poll &&
    !!poll.question.trim() &&
    options.every((o) => o) &&
    options.length >= 2;
  const hasText = !isEmptyDoc(doc);
  const canSubmit = !pending && (poll ? pollReady : hasText);

  const submit = async () => {
    if (!canSubmit) return;
    const ok = await run("comment", t`댓글을 달지 못했습니다`, () =>
      commentsApi.create(postId, {
        body: hasText ? doc : null,
        parentId,
        poll: poll
          ? {
              question: poll.question.trim(),
              options,
              closesAt: poll.closesAt
                ? new Date(poll.closesAt).toISOString()
                : undefined,
            }
          : undefined,
      }),
    );
    if (!ok) return;
    setDoc(null);
    setPoll(null);
    setRound((r) => r + 1);
    onDone?.();
  };

  const setOption = (i: number, value: string) =>
    poll &&
    setPoll({
      ...poll,
      options: poll.options.map((o, k) => (k === i ? value : o)),
    });

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <RichEditor
        key={round}
        initial={null}
        onChange={setDoc}
        label={label ?? t`댓글`}
        size="sm"
        toolbar={false}
        autoFocus={autoFocus}
        onSubmit={submit}
      />
      {poll && (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-line bg-panel-subtle p-3">
          <legend className="sr-only">
            <Trans>투표 만들기</Trans>
          </legend>
          <div className="flex items-center gap-2">
            <ChartBar
              size={14}
              className="flex-none text-accent"
              aria-hidden="true"
            />
            <input
              className={field()}
              value={poll.question}
              maxLength={200}
              placeholder={t`질문`}
              aria-label={t`투표 질문`}
              onChange={(e) =>
                setPoll({ ...poll, question: e.currentTarget.value })
              }
            />
            <button
              type="button"
              className={itemButton()}
              aria-label={t`투표 빼기`}
              onClick={() => setPoll(null)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
          <ol className="flex flex-col gap-1.5 pl-5.5">
            {poll.options.map((option, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 선택지는 순서가 곧 id다
              <li key={i} className="flex items-center gap-1.5">
                <input
                  className={field()}
                  value={option}
                  maxLength={80}
                  placeholder={t`선택지 ${ph({ n: i + 1 })}`}
                  aria-label={t`선택지 ${ph({ n: i + 1 })}`}
                  onChange={(e) => setOption(i, e.currentTarget.value)}
                />
                <button
                  type="button"
                  className={itemButton()}
                  aria-label={t`선택지 ${ph({ n: i + 1 })} 빼기`}
                  disabled={poll.options.length <= 2}
                  onClick={() =>
                    setPoll({
                      ...poll,
                      options: poll.options.filter((_, k) => k !== i),
                    })
                  }
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-5.5">
            {poll.options.length < 6 && (
              <button
                type="button"
                className={linkButton({ class: "self-auto" })}
                onClick={() =>
                  setPoll({ ...poll, options: [...poll.options, ""] })
                }
              >
                <Plus size={12} aria-hidden="true" />
                <Trans>선택지 더하기</Trans>
              </button>
            )}
            <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
              <Trans context="poll deadline">마감</Trans>
              <input
                type="datetime-local"
                className={field({ class: "w-auto" })}
                value={poll.closesAt}
                onChange={(e) =>
                  setPoll({ ...poll, closesAt: e.currentTarget.value })
                }
              />
            </label>
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!parentId && !poll && (
          <button
            type="button"
            className={button({ size: "sm" })}
            onClick={() => setPoll(emptyPoll())}
          >
            <ChartBar size={13} aria-hidden="true" />
            <Trans>투표 만들기</Trans>
          </button>
        )}
        <span className="text-2xs text-fg-muted max-sm:hidden">
          <Trans>@로 멘션 · Ctrl/⌘+Enter로 보내기</Trans>
        </span>
        <span className="ml-auto flex gap-1.5">
          {onDone && (
            <button
              type="button"
              className={button({ size: "sm" })}
              disabled={!!pending}
              onClick={onDone}
            >
              <Trans context="cancel comment">취소</Trans>
            </button>
          )}
          <button
            type="button"
            className={button({ size: "sm", variant: "primary" })}
            disabled={!canSubmit}
            onClick={submit}
          >
            {pending && <Spinner size="sm" tone="inherit" />}
            {submitLabel ?? t`댓글 달기`}
          </button>
        </span>
      </div>
    </div>
  );
}

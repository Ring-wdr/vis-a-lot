"use client";

// 댓글에 붙는 것: 반응 막대(이모지 켜기·끄기)와 투표.

import { ChartBar, Check, SmilePlus } from "lucide-react";
import type { Comment, Poll } from "@/feed/api/comments";
import { commentsApi } from "@/feed/api/comments";
import { tv } from "@/shared/lib/tw";
import { Popover } from "@/shared/ui/Popover";
import { dateTime } from "./time";
import { useCommentAction } from "./use-comment-action";

export const EMOJIS = ["👍", "🎉", "👀", "❤️", "😄", "🙏"] as const;

const reactionButton = tv({
  base: "inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-line bg-elevated px-2 text-xs text-fg-secondary hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:text-accent",
});

export function ReactionsBar({ comment }: { comment: Comment }) {
  const { run, pending } = useCommentAction();
  const toggle = (emoji: string, on: boolean) =>
    run("react", "반응을 바꾸지 못했습니다", () =>
      commentsApi.react(comment.id, emoji, on),
    );
  const mine = new Set(
    comment.reactions.filter((r) => r.mine).map((r) => r.emoji),
  );

  return (
    <div className="flex flex-wrap items-center gap-1" aria-busy={!!pending}>
      {comment.reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className={reactionButton()}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}명${r.mine ? ", 내가 누름" : ""}`}
          disabled={!!pending}
          onClick={() => toggle(r.emoji, !r.mine)}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}
      <Popover
        trigger={<SmilePlus size={13} aria-hidden="true" />}
        triggerLabel="반응 더하기"
        triggerClassName={reactionButton({ class: "px-1.5" })}
        width={208}
        panelClassName="p-1.5"
      >
        {(close) => (
          <fieldset className="flex gap-0.5">
            <legend className="sr-only">반응 고르기</legend>
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="inline-grid size-8 cursor-pointer place-items-center rounded-md text-base hover:bg-panel-hover aria-pressed:bg-accent-soft"
                aria-pressed={mine.has(emoji)}
                aria-label={emoji}
                onClick={() => {
                  close();
                  toggle(emoji, !mine.has(emoji));
                }}
              >
                {emoji}
              </button>
            ))}
          </fieldset>
        )}
      </Popover>
    </div>
  );
}

export function PollView({ poll }: { poll: Poll }) {
  const { run, pending } = useCommentAction();
  const total = poll.votes.reduce((a, b) => a + b, 0);
  return (
    <fieldset className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel-subtle p-3">
      <legend className="sr-only">투표: {poll.question}</legend>
      <p className="flex items-center gap-1.5 text-ui font-semibold">
        <ChartBar
          size={14}
          className="flex-none text-accent"
          aria-hidden="true"
        />
        {poll.question}
      </p>
      {poll.options.map((option, i) => {
        const votes = poll.votes[i] ?? 0;
        const pct = total ? Math.round((votes / total) * 100) : 0;
        const mine = poll.myVote === i;
        return (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: 선택지는 순서가 곧 id다
            key={i}
            type="button"
            className="relative flex min-h-8 cursor-pointer items-center gap-2 overflow-hidden rounded-md border border-line bg-elevated px-2.5 text-left text-ui enabled:hover:border-line-strong disabled:cursor-default aria-pressed:border-accent"
            aria-pressed={mine}
            disabled={poll.closed || !!pending}
            onClick={() =>
              run("vote", "투표하지 못했습니다", () =>
                commentsApi.vote(poll.id, i),
              )
            }
          >
            <span
              className="absolute inset-y-0 left-0 bg-accent-soft"
              style={{ width: `${pct}%` }}
              aria-hidden="true"
            />
            <span className="relative flex min-w-0 flex-1 items-center gap-1.5">
              {mine && (
                <Check
                  size={13}
                  className="flex-none text-accent"
                  aria-label="내 선택"
                />
              )}
              <span className="min-w-0 truncate">{option}</span>
            </span>
            <span className="relative text-xs text-fg-secondary tabular-nums">
              {votes}표 · {pct}%
            </span>
          </button>
        );
      })}
      <p className="text-2xs text-fg-muted">
        {total}명 참여
        {poll.closed
          ? " · 마감됨"
          : poll.closesAt
            ? ` · ${dateTime.format(new Date(poll.closesAt))} 마감`
            : ""}
        {!poll.closed &&
          poll.myVote !== null &&
          " · 다른 선택지를 누르면 바뀝니다"}
      </p>
    </fieldset>
  );
}

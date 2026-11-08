"use client";

// 댓글에 붙는 것: 반응 막대(이모지 켜기·끄기)와 투표.

import { ChartBar, Check, SmilePlus } from "lucide-react";
import { useCommentAction } from "@/features/comment-post/model/use-comment-action";
import type { Comment, Poll } from "@/shared/api/feed/comments";
import { commentsApi } from "@/shared/api/feed/comments";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { dateTime } from "@/shared/lib/time";
import { tv } from "@/shared/lib/tw";
import { Popover } from "@/shared/ui/Popover";

export const EMOJIS = ["👍", "🎉", "👀", "❤️", "😄", "🙏"] as const;

const messages = defineMessages({
  ko: {
    reactFailed: "반응을 바꾸지 못했습니다",
    reaction: (emoji: string, n: number, mine: boolean) =>
      `${emoji} ${n}명${mine ? ", 내가 누름" : ""}`,
    addReaction: "반응 더하기",
    pickReaction: "반응 고르기",
    poll: (question: string) => `투표: ${question}`,
    voteFailed: "투표하지 못했습니다",
    myVote: "내 선택",
    votes: (n: number, pct: number) => `${n}표 · ${pct}%`,
    participants: (n: number) => `${n}명 참여`,
    closed: " · 마감됨",
    closesAt: (at: string) => ` · ${at} 마감`,
    changeHint: " · 다른 선택지를 누르면 바뀝니다",
  },
  en: {
    reactFailed: "Couldn't update the reaction",
    reaction: (emoji: string, n: number, mine: boolean) =>
      `${emoji} ${n}${mine ? ", including you" : ""}`,
    addReaction: "Add reaction",
    pickReaction: "Pick a reaction",
    poll: (question: string) => `Poll: ${question}`,
    voteFailed: "Couldn't vote",
    myVote: "My vote",
    votes: (n: number, pct: number) =>
      `${n} ${n === 1 ? "vote" : "votes"} · ${pct}%`,
    participants: (n: number) => `${n} voted`,
    closed: " · Closed",
    closesAt: (at: string) => ` · Closes ${at}`,
    changeHint: " · Pick another option to change",
  },
});

const reactionButton = tv({
  base: "inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-line bg-elevated px-2 text-xs text-fg-secondary hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:text-accent",
});

export function ReactionsBar({ comment }: { comment: Comment }) {
  const text = useT(messages);
  const { run, pending } = useCommentAction();
  const toggle = (emoji: string, on: boolean) =>
    run("react", text.reactFailed, () =>
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
          aria-label={text.reaction(r.emoji, r.count, r.mine)}
          disabled={!!pending}
          onClick={() => toggle(r.emoji, !r.mine)}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}
      <Popover
        trigger={<SmilePlus size={13} aria-hidden="true" />}
        triggerLabel={text.addReaction}
        triggerClassName={reactionButton({ class: "px-1.5" })}
        width={208}
        panelClassName="p-1.5"
      >
        {(close) => (
          <fieldset className="flex gap-0.5">
            <legend className="sr-only">{text.pickReaction}</legend>
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="inline-grid size-8 cursor-pointer place-items-center rounded-md text-base hover:bg-panel-hover aria-pressed:bg-accent-soft"
                aria-pressed={mine.has(emoji)}
                aria-label={emoji}
                onClick={() => {
                  close();
                  void toggle(emoji, !mine.has(emoji));
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
  const text = useT(messages);
  const { run, pending } = useCommentAction();
  const total = poll.votes.reduce((a, b) => a + b, 0);
  return (
    <fieldset className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel-subtle p-3">
      <legend className="sr-only">{text.poll(poll.question)}</legend>
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
              run("vote", text.voteFailed, () => commentsApi.vote(poll.id, i))
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
                  aria-label={text.myVote}
                />
              )}
              <span className="min-w-0 truncate">{option}</span>
            </span>
            <span className="relative text-xs text-fg-secondary tabular-nums">
              {text.votes(votes, pct)}
            </span>
          </button>
        );
      })}
      <p className="text-2xs text-fg-muted">
        {text.participants(total)}
        {poll.closed
          ? text.closed
          : poll.closesAt
            ? text.closesAt(dateTime().format(new Date(poll.closesAt)))
            : ""}
        {!poll.closed && poll.myVote !== null && text.changeHint}
      </p>
    </fieldset>
  );
}

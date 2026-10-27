"use client";

// 댓글: 스레드(첫 댓글 + 대댓글 한 단계), 반응, 고치기·지우기, 스레드 해결(접어 둠)·고정, 투표, 입력.

import type { JSONContent } from "@tiptap/react";
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Reply,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { chip, detail } from "@/entities/post/ui/styles";
import { useCommentAction } from "@/features/comment-post/model/use-comment-action";
import { CommentComposer } from "@/features/comment-post/ui/comment-composer";
import {
  PollView,
  ReactionsBar,
} from "@/features/comment-post/ui/comment-extras";
import { useComments } from "@/shared/api/feed/comment-queries";
import type { Comment, CommentThread } from "@/shared/api/feed/comments";
import { commentsApi } from "@/shared/api/feed/comments";
import { useUserMap } from "@/shared/api/feed/lookups";
import { useFeedNow } from "@/shared/api/feed/queries";
import { dateTime, relativeTime } from "@/shared/lib/time";
import { showConfirm } from "@/shared/ui/AlertDialog";
import { Avatar } from "@/shared/ui/Avatar";
import { button, itemButton } from "@/shared/ui/button";
import { LoadingText, Skeleton, Spinner } from "@/shared/ui/Loading";
import { RichEditor, RichView } from "@/shared/ui/rich-editor/RichEditor";
import { docText, isEmptyDoc, toDoc } from "@/shared/ui/rich-editor/rich-text";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";

const d = detail();

export function PostComments({ post }: { post: PostDetail }) {
  const threads = useComments(post.key);
  const count = useMemo(
    () =>
      (threads.data ?? []).reduce(
        (n, t) => n + (t.deleted ? 0 : 1) + t.replies.length,
        0,
      ),
    [threads.data],
  );
  const now = useFeedNow();

  return (
    <section className={d.section()} aria-labelledby="post-comments-title">
      <h2 id="post-comments-title" className={d.sectionTitle()}>
        댓글
        {threads.data && (
          <span className="ml-1.5 font-normal text-fg-muted tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {threads.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <LoadingText>댓글을 불러오는 중</LoadingText>
          <Skeleton width={70} />
          <Skeleton width={50} />
        </div>
      ) : threads.isError ? (
        <p role="alert" className={d.error()}>
          댓글을 불러오지 못했습니다: {threads.error.message}
        </p>
      ) : threads.data.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-fg-muted">
          <MessageSquare size={14} aria-hidden="true" />
          아직 댓글이 없습니다. 첫 댓글을 남겨 보세요.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5" aria-label="댓글 스레드">
          {threads.data.map((t) => (
            <Thread key={t.id} thread={t} postId={post.id} now={now} />
          ))}
        </ol>
      )}
      <CommentComposer postId={post.id} />
    </section>
  );
}

function Thread({
  thread,
  postId,
  now,
}: {
  thread: CommentThread;
  postId: string;
  now: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const users = useUserMap();
  const collapsed = thread.resolved && !expanded;
  const author = users.get(thread.authorId)?.name ?? thread.authorId;
  const preview = thread.deleted
    ? "삭제된 댓글"
    : docText(toDoc(thread.body)).replace(/\s+/g, " ").trim() ||
      thread.poll?.question ||
      "";

  if (collapsed)
    return (
      <li>
        <button
          type="button"
          className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel-subtle px-3 py-2 text-left text-xs text-fg-secondary hover:bg-panel-hover"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          <ChevronRight size={13} className="flex-none" aria-hidden="true" />
          <span className={chip({ tone: "accent" })}>
            <CircleCheck size={11} aria-hidden="true" />
            해결됨
          </span>
          <span className="flex-none font-semibold text-fg">{author}</span>
          <span className="min-w-0 flex-1 truncate">{preview}</span>
          {thread.replies.length > 0 && (
            <span className="flex-none tabular-nums">
              답글 {thread.replies.length}
            </span>
          )}
        </button>
      </li>
    );

  return (
    <li
      className="flex flex-col gap-2 rounded-lg border border-line bg-elevated p-3 data-pinned:border-accent-line"
      data-pinned={thread.pinned ? "" : undefined}
    >
      {thread.resolved && (
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1.5 self-start text-2xs text-fg-muted hover:text-fg"
          aria-expanded={true}
          onClick={() => setExpanded(false)}
        >
          <ChevronDown size={12} aria-hidden="true" />
          <span className={chip({ tone: "accent" })}>
            <CircleCheck size={11} aria-hidden="true" />
            해결됨
          </span>
          접기
        </button>
      )}
      <CommentItem
        comment={thread}
        now={now}
        onReply={() => setReplying(true)}
      />
      {thread.replies.length > 0 && (
        <ol
          className="ml-3 flex flex-col gap-2 border-l-2 border-line pl-3"
          aria-label="답글"
        >
          {thread.replies.map((r) => (
            <li key={r.id}>
              <CommentItem
                comment={r}
                now={now}
                onReply={() => setReplying(true)}
              />
            </li>
          ))}
        </ol>
      )}
      {replying ? (
        <div className="ml-3 pl-3">
          <CommentComposer
            postId={postId}
            parentId={thread.id}
            label="답글"
            submitLabel="답글 달기"
            autoFocus
            onDone={() => setReplying(false)}
          />
        </div>
      ) : (
        !thread.deleted && (
          <button
            type="button"
            className="ml-3 flex cursor-pointer items-center gap-1 self-start pl-3 text-xs text-fg-muted hover:text-accent"
            onClick={() => setReplying(true)}
          >
            <Reply size={12} aria-hidden="true" />
            답글 달기
          </button>
        )
      )}
    </li>
  );
}

function CommentItem({
  comment,
  now,
  onReply,
}: {
  comment: Comment;
  now: number;
  onReply: () => void;
}) {
  const users = useUserMap();
  const { run, pending } = useCommentAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<JSONContent | null>(null);
  const body = useMemo(() => toDoc(comment.body), [comment.body]);
  const author = users.get(comment.authorId)?.name ?? comment.authorId;
  const root = comment.parentId === null;
  const p = comment.permissions;

  const save = async () => {
    if (!comment.poll && isEmptyDoc(draft)) return;
    if (
      await run("edit", "댓글을 고치지 못했습니다", () =>
        commentsApi.update(comment.id, isEmptyDoc(draft) ? null : draft),
      )
    )
      setEditing(false);
  };

  return (
    <article
      className="group/comment flex min-w-0 gap-2.5"
      aria-label={`${author}의 댓글`}
    >
      <Avatar name={author} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <header className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <span className="font-semibold text-fg">{author}</span>
          <time
            className="text-2xs text-fg-muted"
            dateTime={comment.createdAt}
            title={dateTime.format(new Date(comment.createdAt))}
          >
            {relativeTime(comment.createdAt, now)}
          </time>
          {comment.updatedAt && !comment.deleted && (
            <span
              className="text-2xs text-fg-muted"
              title={dateTime.format(new Date(comment.updatedAt))}
            >
              (수정됨)
            </span>
          )}
          {comment.pinned && (
            <span className={chip({ tone: "accent" })}>
              <Pin size={11} aria-hidden="true" />
              고정됨
            </span>
          )}
          {!comment.deleted && !editing && (
            <span className="ml-auto flex gap-0.5 opacity-100 sm:opacity-0 sm:group-focus-within/comment:opacity-100 sm:group-hover/comment:opacity-100">
              {!root && (
                <button
                  type="button"
                  className={itemButton()}
                  aria-label="답글"
                  title="답글"
                  onClick={onReply}
                >
                  <Reply size={12} aria-hidden="true" />
                </button>
              )}
              {root && p.pin && (
                <button
                  type="button"
                  className={itemButton()}
                  aria-label={comment.pinned ? "고정 풀기" : "스레드 고정"}
                  title={comment.pinned ? "고정 풀기" : "스레드 고정"}
                  disabled={!!pending}
                  onClick={() =>
                    run("pin", "고정을 바꾸지 못했습니다", () =>
                      commentsApi.pin(comment.id, !comment.pinned),
                    )
                  }
                >
                  {comment.pinned ? (
                    <PinOff size={12} aria-hidden="true" />
                  ) : (
                    <Pin size={12} aria-hidden="true" />
                  )}
                </button>
              )}
              {root && p.resolve && (
                <button
                  type="button"
                  className={itemButton()}
                  aria-label={comment.resolved ? "다시 열기" : "스레드 해결"}
                  title={comment.resolved ? "다시 열기" : "스레드 해결"}
                  disabled={!!pending}
                  onClick={() =>
                    run("resolve", "해결 상태를 바꾸지 못했습니다", () =>
                      commentsApi.resolve(comment.id, !comment.resolved),
                    )
                  }
                >
                  {comment.resolved ? (
                    <RotateCcw size={12} aria-hidden="true" />
                  ) : (
                    <CircleCheck size={12} aria-hidden="true" />
                  )}
                </button>
              )}
              {p.edit && (
                <button
                  type="button"
                  className={itemButton()}
                  aria-label="고치기"
                  title="고치기"
                  onClick={() => {
                    setDraft(body);
                    setEditing(true);
                  }}
                >
                  <Pencil size={12} aria-hidden="true" />
                </button>
              )}
              {p.delete && (
                <button
                  type="button"
                  className={itemButton()}
                  aria-label="지우기"
                  title="지우기"
                  disabled={!!pending}
                  onClick={async () => {
                    if (
                      await showConfirm("이 댓글을 지울까요?", {
                        confirmLabel: "지우기",
                      })
                    )
                      run("delete", "댓글을 지우지 못했습니다", () =>
                        commentsApi.remove(comment.id),
                      );
                  }}
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              )}
            </span>
          )}
        </header>
        {comment.deleted ? (
          <p className="text-ui text-fg-muted italic">삭제된 댓글입니다.</p>
        ) : editing ? (
          <div className="flex flex-col gap-1.5">
            <RichEditor
              initial={body}
              onChange={setDraft}
              label="댓글 고치기"
              size="sm"
              toolbar={false}
              autoFocus
              onSubmit={save}
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                className={button({ size: "sm" })}
                disabled={!!pending}
                onClick={() => setEditing(false)}
              >
                취소
              </button>
              <button
                type="button"
                className={button({ size: "sm", variant: "primary" })}
                disabled={!!pending || (!comment.poll && isEmptyDoc(draft))}
                onClick={save}
              >
                {pending === "edit" && <Spinner size="sm" tone="inherit" />}
                저장
              </button>
            </div>
          </div>
        ) : (
          body && !isEmptyDoc(body) && <RichView content={body} />
        )}
        {comment.poll && <PollView poll={comment.poll} />}
        {!comment.deleted && <ReactionsBar comment={comment} />}
      </div>
    </article>
  );
}

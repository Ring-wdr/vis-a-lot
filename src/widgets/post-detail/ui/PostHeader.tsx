"use client";

// 상세 머리: 키·그룹·제목(고치기), 상태 배지와 전이 버튼, 구독·끌어올리기·지우기.

import { Bell, BellOff, Check, Pencil, Pin, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  CANCEL_REASON_LABELS,
  HOLD_REASON_LABELS,
  statusLabel,
} from "@/entities/post/lib/labels";
import { usePostAction } from "@/entities/post/model/use-post-action";
import { chip, field, statusBadge } from "@/entities/post/ui/styles";
import {
  askCancelReason,
  askHold,
  askRejectComment,
} from "@/features/transition-post/ui/transition-dialogs";
import { postsApi } from "@/shared/api/feed/posts";
import type { Group } from "@/shared/api/feed/types";
import { cn } from "@/shared/lib/tw";
import { showConfirm } from "@/shared/ui/AlertDialog";
import { button, toolButton } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";

type Action = {
  name: string;
  label: string;
  primary?: boolean;
  danger?: boolean;
  /** 없으면 팝업으로 입력을 받는다 (withInput) */
  run?: () => Promise<unknown>;
  failure: string;
};

/** 권한에 맞는 전이 버튼들 */
function transitionActions(post: PostDetail): Action[] {
  const p = post.permissions;
  const can = (to: PostDetail["status"]) => p.transitions.includes(to);
  const actions: Action[] = [];
  if (post.status === "unresolved" && can("in_progress"))
    actions.push({
      name: "start",
      label: "진행 시작",
      primary: true,
      failure: "진행을 시작하지 못했습니다",
      run: () => postsApi.transition(post.id, { to: "in_progress" }),
    });
  if (p.requestReview)
    actions.push({
      name: "requestReview",
      label: "완료 요청",
      primary: true,
      failure: "완료를 요청하지 못했습니다",
      run: () => postsApi.requestReview(post.id),
    });
  if (p.approve)
    actions.push({
      name: "approve",
      label: "승인",
      primary: true,
      failure: "승인하지 못했습니다",
      run: () => postsApi.approve(post.id),
    });
  if (p.reject)
    actions.push({
      name: "reject",
      label: "반려",
      danger: true,
      failure: "반려하지 못했습니다",
    });
  if (post.status === "on_hold" && can("unresolved"))
    actions.push({
      name: "resume",
      label: "미해결로",
      failure: "보류를 풀지 못했습니다",
      run: () => postsApi.transition(post.id, { to: "unresolved" }),
    });
  if (p.reopen)
    actions.push({
      name: "reopen",
      label: "다시 열기",
      failure: "다시 열지 못했습니다",
      run: () => postsApi.reopen(post.id),
    });
  if (can("on_hold"))
    actions.push({
      name: "hold",
      label: "보류",
      failure: "보류하지 못했습니다",
    });
  if (can("cancelled"))
    actions.push({
      name: "cancel",
      label: "취소",
      failure: "취소하지 못했습니다",
    });
  return actions;
}

/** 팝업으로 입력을 받는 전이. 팝업을 닫으면 null */
async function withInput(name: string, post: PostDetail) {
  switch (name) {
    case "reject": {
      const comment = await askRejectComment();
      return comment ? () => postsApi.reject(post.id, comment) : null;
    }
    case "hold": {
      const input = await askHold();
      return input
        ? () => postsApi.transition(post.id, { to: "on_hold", ...input })
        : null;
    }
    case "cancel": {
      const reason = await askCancelReason();
      return reason
        ? () => postsApi.transition(post.id, { to: "cancelled", reason })
        : null;
    }
  }
  return null;
}

function closeReasonLabel(post: PostDetail) {
  const r = post.closeReason;
  if (!r) return null;
  if (post.status === "cancelled")
    return CANCEL_REASON_LABELS[r as keyof typeof CANCEL_REASON_LABELS] ?? r;
  return HOLD_REASON_LABELS[r as keyof typeof HOLD_REASON_LABELS] ?? r;
}

function TitleEditor({ post }: { post: PostDetail }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(post.title);
  const { run, pending } = usePostAction();

  if (!editing)
    return (
      <div className="group/title flex min-w-0 items-start gap-1.5">
        <h1 className="min-w-0 text-xl font-bold wrap-break-word">
          {post.title}
        </h1>
        {post.permissions.edit && (
          <button
            type="button"
            className={cn(toolButton(), "mt-0.5 h-6.5 w-7 flex-none")}
            aria-label="제목 고치기"
            title="제목 고치기"
            onClick={() => {
              setValue(post.title);
              setEditing(true);
            }}
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    );

  const save = async () => {
    const title = value.trim();
    if (!title || title === post.title) return setEditing(false);
    if (
      await run("title", "제목을 바꾸지 못했습니다", () =>
        postsApi.update(post.id, { title }),
      )
    )
      setEditing(false);
  };
  return (
    <form
      className="flex min-w-0 items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        className={field({ class: "h-9 text-base font-semibold" })}
        value={value}
        maxLength={200}
        aria-label="제목"
        // biome-ignore lint/a11y/noAutofocus: 고치기를 누르면 바로 입력한다
        autoFocus
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setEditing(false);
          }
        }}
      />
      <button
        type="submit"
        className={cn(toolButton(), "flex-none")}
        aria-label="제목 저장"
        disabled={!!pending}
      >
        {pending ? (
          <Spinner size="sm" />
        ) : (
          <Check size={14} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className={cn(toolButton(), "flex-none")}
        aria-label="고치기 취소"
        onClick={() => setEditing(false)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </form>
  );
}

export function PostHeader({
  post,
  group,
  onDeleted,
}: {
  post: PostDetail;
  group: Group | undefined;
  onDeleted: () => void;
}) {
  const { run, pending } = usePostAction();
  const actions = transitionActions(post);
  const reason = closeReasonLabel(post);
  const pinned = !!post.pinnedAt;

  return (
    <header className="flex min-w-0 flex-col gap-2.5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
        <span className="font-semibold text-fg-secondary tabular-nums">
          {post.key}
        </span>
        <span aria-hidden="true">·</span>
        <span>{group?.name ?? post.groupId}</span>
      </p>
      <TitleEditor key={post.title} post={post} />
      <div className="flex flex-wrap items-center gap-2">
        <span className={statusBadge({ status: post.status })}>
          {statusLabel(post.status, group?.statusNames)}
        </span>
        {post.blocked && <span className={chip({ tone: "danger" })}>막힘</span>}
        {reason && (
          <span className={chip()}>
            {post.status === "cancelled" ? "취소 사유" : "보류 사유"}: {reason}
          </span>
        )}
        {post.status === "on_hold" && post.holdUntil && (
          <span className={chip()}>재개일 {post.holdUntil}</span>
        )}
        {post.reopenCount > 0 && (
          <span className={chip()}>다시 연 횟수 {post.reopenCount}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((a) => (
          <button
            key={a.name}
            type="button"
            className={button({
              size: "sm",
              variant: a.primary
                ? "primary"
                : a.danger
                  ? "danger"
                  : "secondary",
            })}
            disabled={!!pending}
            aria-busy={pending === a.name}
            onClick={async () => {
              const fn = a.run ?? (await withInput(a.name, post));
              if (fn) await run(a.name, a.failure, fn);
            }}
          >
            {pending === a.name && (
              <Spinner size="sm" tone={a.primary ? "inherit" : undefined} />
            )}
            {a.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={toolButton()}
            aria-pressed={post.subscribed}
            aria-label={post.subscribed ? "구독 끄기" : "구독"}
            title={
              post.subscribed
                ? "구독 중: 누르면 알림을 끕니다"
                : "구독: 바뀌면 알림을 받습니다"
            }
            disabled={!!pending}
            onClick={() =>
              run("subscribe", "구독을 바꾸지 못했습니다", () =>
                postsApi.subscribe(post.id, !post.subscribed),
              )
            }
          >
            {post.subscribed ? (
              <Bell size={14} aria-hidden="true" />
            ) : (
              <BellOff size={14} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className={toolButton()}
            aria-pressed={pinned}
            aria-label={pinned ? "끌어올리기 해제" : "끌어올리기"}
            title={
              pinned
                ? "끌어올림: 누르면 해제합니다"
                : "끌어올리기: 홈 피드 위쪽에 둡니다"
            }
            disabled={!!pending}
            onClick={() =>
              run("pin", "끌어올리기를 바꾸지 못했습니다", () =>
                postsApi.pin(post.id, !pinned),
              )
            }
          >
            <Pin size={14} aria-hidden="true" />
          </button>
          {post.permissions.delete && (
            <button
              type="button"
              className={cn(toolButton(), "text-danger")}
              aria-label="지우기"
              title="지우기"
              disabled={!!pending}
              onClick={async () => {
                const ok = await showConfirm(
                  `${post.key} '${post.title}'을(를) 지울까요?`,
                  { confirmLabel: "지우기" },
                );
                if (!ok) return;
                if (
                  await run("delete", "지우지 못했습니다", () =>
                    postsApi.remove(post.id),
                  )
                )
                  onDeleted();
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
    </header>
  );
}

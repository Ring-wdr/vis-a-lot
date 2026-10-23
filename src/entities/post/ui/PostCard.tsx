"use client";

// 피드 카드: 썸네일·제목·상태·담당자·기한. 홈 피드와 저장된 뷰(피드 표시)가 쓴다.

import { Ban, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import type { PostSummary } from "@/shared/api/feed/types";
import {
  DueLabel,
  PriorityMark,
  StatusBadge,
  Thumb,
  UserChip,
  useToday,
} from "./post-meta";

export type PostCardProps = {
  post: PostSummary;
  /** 누르면 옆 패널로 연다 (보통 useOpenPeek) */
  onOpen?: (key: string) => void;
  /** 카드 오른쪽 위에 겹쳐 놓는 버튼 (홈 피드의 끌어올리기 등). 카드를 여는 클릭과 겹치지 않게 한다 */
  actions?: ReactNode;
};

export function PostCard({ post, onOpen, actions }: PostCardProps) {
  const today = useToday();
  return (
    <article className="group/card relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-elevated shadow-xs hover:border-line-strong has-focus-visible:outline-2 has-focus-visible:outline-accent">
      {/* 카드 전체가 여는 버튼. actions는 버튼 밖에 겹쳐 놓아 클릭이 섞이지 않는다 */}
      <button
        type="button"
        className="flex min-w-0 cursor-pointer flex-col text-left outline-none"
        onClick={() => onOpen?.(post.key)}
      >
        <Thumb
          post={post}
          className="aspect-16/10 w-full border-b border-line"
        />
        <span className="flex min-w-0 flex-col gap-1.5 p-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="font-mono text-2xs text-fg-muted">{post.key}</span>
            <StatusBadge status={post.status} groupId={post.groupId} />
            {post.blocked && (
              <span
                className="inline-flex items-center gap-0.5 text-2xs font-semibold text-danger"
                title="막힘: 열린 게시물이 이 게시물을 막고 있습니다"
              >
                <Ban size={12} aria-hidden="true" />
                막힘
              </span>
            )}
            <span className="ml-auto">
              <PriorityMark priority={post.priority} />
            </span>
          </span>
          <span className="line-clamp-2 min-h-9 text-sm/4.5 font-semibold text-fg">
            {post.title}
          </span>
          {post.progress > 0 && (
            <span
              className="block h-1 overflow-hidden rounded-full bg-panel-strong"
              role="progressbar"
              aria-valuenow={post.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="진행률"
            >
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${post.progress}%` }}
              />
            </span>
          )}
          <span className="flex min-w-0 items-center gap-2">
            <UserChip userId={post.assigneeId} />
            <span className="ml-auto inline-flex flex-none items-center gap-2">
              {post.commentCount > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 text-xs text-fg-muted tabular-nums"
                  title={`댓글 ${post.commentCount}개`}
                >
                  <MessageSquare size={12} aria-hidden="true" />
                  {post.commentCount}
                  <span className="sr-only">개 댓글</span>
                </span>
              )}
              <DueLabel post={post} today={today} />
            </span>
          </span>
        </span>
      </button>
      {actions && (
        <div className="z-item-toolbar absolute top-2 right-2 flex gap-1">
          {actions}
        </div>
      )}
    </article>
  );
}

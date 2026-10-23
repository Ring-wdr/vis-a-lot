"use client";

// 상세 안에서 다른 게시물로 가는 링크. 옆 패널 안이면 패널을 그 게시물로 바꾸고, 전체 페이지면 그 페이지로 간다.

import Link from "next/link";
import { createContext, type ReactNode, useContext } from "react";
import type { PostRef } from "@/feed/api/types";
import { statusLabel } from "@/feed/lib/labels";
import { useOpenPeek } from "@/feed/lib/peek";
import { FEED } from "@/feed/lib/routes";
import { statusBadge } from "./styles";

export type DetailMode = "page" | "panel";

export const DetailModeContext = createContext<DetailMode>("page");

export const postPageHref = (key: string) =>
  `${FEED.post}?key=${encodeURIComponent(key)}`;

export function PostLink({
  postKey,
  className,
  children,
}: {
  postKey: string;
  className?: string;
  children: ReactNode;
}) {
  const mode = useContext(DetailModeContext);
  const openPeek = useOpenPeek();
  return (
    <Link
      href={postPageHref(postKey)}
      className={className}
      onClick={(e) => {
        if (mode !== "panel" || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        openPeek(postKey);
      }}
    >
      {children}
    </Link>
  );
}

/** 관계·하위 목록의 한 줄: 키 · 제목 · 상태 */
export function PostRefRow({
  post,
  aside,
}: {
  post: PostRef;
  aside?: ReactNode;
}) {
  return (
    <span className="flex min-h-7.5 min-w-0 items-center gap-2 rounded-md px-1.5 hover:bg-panel">
      <PostLink
        postKey={post.key}
        className="flex min-w-0 flex-1 items-center gap-2 text-fg"
      >
        <span className="flex-none text-xs font-semibold text-fg-secondary tabular-nums">
          {post.key}
        </span>
        <span className="min-w-0 flex-1 truncate">{post.title}</span>
      </PostLink>
      <span className={statusBadge({ status: post.status })}>
        {statusLabel(post.status)}
      </span>
      {aside}
    </span>
  );
}

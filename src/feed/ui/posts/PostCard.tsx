"use client";

// 피드 카드: 썸네일·제목·상태·담당자·기한. 홈 피드와 저장된 뷰(피드 표시)가 쓴다. (구현: 목록 화면 작업)

import type { PostSummary } from "@/feed/api/types";

export type PostCardProps = {
  post: PostSummary;
  /** 누르면 옆 패널로 연다 (보통 useOpenPeek) */
  onOpen?: (key: string) => void;
};

export function PostCard({ post, onOpen }: PostCardProps) {
  return (
    <button type="button" onClick={() => onOpen?.(post.key)}>
      {post.key} {post.title}
    </button>
  );
}

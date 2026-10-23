"use client";

// 피드 카드: 썸네일·제목·상태·담당자·기한. 홈 피드와 저장된 뷰(피드 표시)가 쓴다. (구현: 목록 화면 작업)

import type { ReactNode } from "react";
import type { PostSummary } from "@/feed/api/types";

export type PostCardProps = {
  post: PostSummary;
  /** 누르면 옆 패널로 연다 (보통 useOpenPeek) */
  onOpen?: (key: string) => void;
  /** 카드 오른쪽 위에 겹쳐 놓는 버튼 (홈 피드의 끌어올리기 등). 카드를 여는 클릭과 겹치지 않게 한다 */
  actions?: ReactNode;
};

export function PostCard({ post, onOpen }: PostCardProps) {
  return (
    <button type="button" onClick={() => onOpen?.(post.key)}>
      {post.key} {post.title}
    </button>
  );
}

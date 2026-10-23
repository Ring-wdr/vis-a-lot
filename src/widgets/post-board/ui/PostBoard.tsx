"use client";

// 칸반 보드: 상태 열(카테고리 순), 드래그로 상태 변경, 팀 스윔레인. 보드와 저장된 뷰(보드 표시)가 쓴다. (구현: 목록 화면 작업)

import type { PostSummary, Team } from "@/shared/api/feed/types";

export type PostBoardProps = {
  posts: PostSummary[];
  /** 팀별 스윔레인. 없으면 한 줄 */
  swimlane?: "team" | null;
  teams?: Team[];
  onOpen?: (key: string) => void;
};

export function PostBoard({ posts, onOpen }: PostBoardProps) {
  return <PostListFallback posts={posts} onOpen={onOpen} />;
}

function PostListFallback({
  posts,
  onOpen,
}: Pick<PostBoardProps, "posts" | "onOpen">) {
  return (
    <ul>
      {posts.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => onOpen?.(p.key)}>
            {p.status} {p.key} {p.title}
          </button>
        </li>
      ))}
    </ul>
  );
}

"use client";

// 리스트 표: 열 선택·정렬·그룹핑·다중 선택. 리스트, 내 작업, 저장된 뷰(리스트 표시)가 쓴다. (구현: 목록 화면 작업)

import type { PostSummary, ViewGroupBy } from "@/feed/api/types";

export const POST_COLUMNS = [
  "key",
  "title",
  "status",
  "priority",
  "assignee",
  "dueDate",
  "updatedAt",
  "thumbnail",
] as const;
export type PostColumn = (typeof POST_COLUMNS)[number];

export type PostTableProps = {
  posts: PostSummary[];
  columns?: readonly PostColumn[];
  groupBy?: ViewGroupBy | null;
  /** 다중 선택(일괄 변경). 없으면 선택 칸을 그리지 않는다 */
  selected?: ReadonlySet<string>;
  onSelectedChange?: (ids: Set<string>) => void;
  onOpen?: (key: string) => void;
};

export function PostTable({ posts, onOpen }: PostTableProps) {
  return (
    <ul>
      {posts.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => onOpen?.(p.key)}>
            {p.key} {p.title}
          </button>
        </li>
      ))}
    </ul>
  );
}

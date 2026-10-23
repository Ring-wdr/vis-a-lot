"use client";

// 옆 패널: ?peek=<키>가 있으면 화면 오른쪽에 게시물 상세를 띄운다. FeedShell이 한 번 붙인다. (구현: 상세 작업)

import { usePeekKey } from "@/shared/lib/peek";

export function PostPeek() {
  const key = usePeekKey();
  if (!key) return null;
  return null;
}

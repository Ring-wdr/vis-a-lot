"use client";

// 옆 패널(peek): 어느 목록에서든 ?peek=<이슈 키>로 게시물 상세를 연다. 목록은 그대로 둔다.
// 패널은 FeedShell이 한 곳에서 띄운다 (src/feed/views/post/PostPeek.tsx).

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function usePeekKey() {
  return useSearchParams().get("peek");
}

/** key를 주면 열고, null이면 닫는다. 다른 query(g, id 등)는 그대로 둔다. */
export function useOpenPeek() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return useCallback(
    (key: string | null) => {
      const next = new URLSearchParams(search);
      if (key) next.set("peek", key);
      else next.delete("peek");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, search],
  );
}

"use client";

// 홈 피드·내 작업이 함께 쓰는 탭 모양과 query 갱신.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { tv } from "@/shared/lib/tw";

/** 밑줄 탭. 링크(지금 탭은 aria-current="page")나 버튼에 단다 */
export const tabStyles = tv({
  slots: {
    list: "flex min-w-0 gap-1 overflow-x-auto border-b border-line",
    tab: "-mb-px inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-2.5 text-ui whitespace-nowrap text-fg-secondary no-underline hover:text-fg aria-[current=page]:border-accent aria-[current=page]:font-semibold aria-[current=page]:text-fg",
    count:
      "rounded-full bg-panel-strong px-1.5 text-2xs text-fg-secondary tabular-nums",
  },
});

/** 지금 경로에 query를 바꾼 링크. 값이 null이면 그 키를 지운다. peek는 닫는다 */
export function useQueryHref() {
  const pathname = usePathname();
  const search = useSearchParams();
  return useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(search);
      next.delete("peek");
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const query = next.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, search],
  );
}

/** query를 바꿔 같은 화면에 머문다 (기록을 쌓지 않는다) */
export function useReplaceQuery() {
  const router = useRouter();
  const href = useQueryHref();
  return useCallback(
    (patch: Record<string, string | null>) =>
      router.replace(href(patch), { scroll: false }),
    [router, href],
  );
}

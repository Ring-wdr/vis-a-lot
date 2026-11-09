"use client";

// 발표 모드 URL: ?present=1 (보고서를 큰 글씨로), &slide=N (게시물 넘겨 보기, 1부터). 다른 query는 그대로 둔다.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function usePresentNav() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const present = search.get("present") === "1";
  const raw = Number(search.get("slide"));
  /** 넘겨 보기 중인 게시물 번호 (0부터). 아니면 null */
  const slide = present && Number.isInteger(raw) && raw >= 1 ? raw - 1 : null;

  const go = useCallback(
    (patch: Record<string, string | null>, push = false) => {
      const next = new URLSearchParams(search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      next.delete("peek");
      const q = next.toString();
      const href = q ? `${pathname}?${q}` : pathname;
      if (push) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [search, router, pathname],
  );

  return {
    present,
    slide,
    start: useCallback(() => go({ present: "1", slide: null }, true), [go]),
    end: useCallback(() => go({ present: null, slide: null }, true), [go]),
    openSlide: useCallback(
      (index: number) => go({ present: "1", slide: String(index + 1) }),
      [go],
    ),
    closeSlides: useCallback(() => go({ slide: null }), [go]),
  };
}

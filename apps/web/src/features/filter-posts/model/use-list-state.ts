"use client";

// 목록 상태(필터·정렬·그룹핑·열)를 URL에서 읽고, 바꾸면 history에 한 칸 쌓는다 (뒤로 가기로 돌아온다).

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { decodeListState, encodeListState, type ListState } from "./filter-url";

export function useListState() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = useMemo(() => decodeListState(search), [search]);
  const update = useCallback(
    (patch: Partial<ListState>) => {
      const next = encodeListState({ ...state, ...patch }, search).toString();
      router.push(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [state, search, router, pathname],
  );
  return [state, update] as const;
}

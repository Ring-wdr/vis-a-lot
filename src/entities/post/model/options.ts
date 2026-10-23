"use client";

// 필드 고르기 목록: 그룹 멤버·게시물 유형·팀·우선순위. 상세 필드 패널과 새 게시물 폼이 같이 쓴다.

import { useMemo } from "react";
import {
  PRIORITY_LABELS,
  type PriorityLevel,
} from "@/entities/post/lib/labels";
import { useUserMap } from "@/shared/api/feed/lookups";
import { useGroup } from "@/shared/api/feed/queries";

/** Select의 "없음" 값. base-ui Select는 빈 문자열을 고른 값으로 그리지 않는다 */
export const NONE = "_none";

export const PRIORITY_OPTIONS = (
  Object.entries(PRIORITY_LABELS) as [string, string][]
).map(([value, label]) => ({ value: Number(value) as PriorityLevel, label }));

/** 그룹 상세와 고르기 목록. 사람은 활성 그룹 멤버만 */
export function useGroupOptions(groupId: string | undefined) {
  const group = useGroup(groupId);
  const users = useUserMap();
  return useMemo(() => {
    const g = group.data;
    const people = (g?.members ?? [])
      .map((m) => users.get(m.userId))
      .filter((u) => u?.active)
      .map((u) => ({ value: u?.id ?? "", label: u?.name ?? "" }))
      .sort((a, b) => a.label.localeCompare(b.label, "ko"));
    return {
      group: g,
      isPending: group.isPending,
      people,
      peopleOrNone: [{ value: NONE, label: "없음" }, ...people],
      postTypes: [
        { value: NONE, label: "없음" },
        ...(g?.postTypes ?? []).map((t) => ({ value: t.id, label: t.name })),
      ],
      teams: [
        { value: NONE, label: "없음" },
        ...(g?.teams ?? []).map((t) => ({ value: t.id, label: t.name })),
      ],
    };
  }, [group.data, group.isPending, users]);
}

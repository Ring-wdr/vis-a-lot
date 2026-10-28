"use client";

// 필드 고르기 목록: 그룹 멤버·게시물 유형·팀·우선순위. 상세 필드 패널과 새 게시물 폼이 같이 쓴다.

import { useMemo } from "react";
import { type PriorityLevel, priorityLabels } from "@/entities/post/lib/labels";
import { useUserMap } from "@/shared/api/feed/lookups";
import { useGroup } from "@/shared/api/feed/queries";
import {
  defineMessages,
  intlLocale,
  type Locale,
  useLocale,
} from "@/shared/lib/i18n";

const messages = defineMessages({
  ko: { inactive: "비활성", notMember: "멤버 아님", none: "없음" },
  en: { inactive: "inactive", notMember: "not a member", none: "None" },
});

/** Select의 "없음" 값. base-ui Select는 빈 문자열을 고른 값으로 그리지 않는다 */
export const NONE = "_none";

/** 우선순위 고르기 목록 (지금 언어). 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다 */
export const priorityOptions = (locale?: Locale) =>
  (Object.entries(priorityLabels(locale)) as [string, string][]).map(
    ([value, label]) => ({ value: Number(value) as PriorityLevel, label }),
  );

/**
 * 그룹 상세와 고르기 목록. 사람은 활성 그룹 멤버만 고를 수 있고,
 * keep에 넣은 사람(지금 담당자 등)은 비활성이거나 멤버가 아니어도 이름이 보이게 남긴다.
 */
export function useGroupOptions(
  groupId: string | undefined,
  keep: readonly (string | null | undefined)[] = [],
) {
  const group = useGroup(groupId);
  const users = useUserMap();
  const locale = useLocale();
  const text = messages[locale];
  const kept = keep.filter((id): id is string => !!id).join(",");
  return useMemo(() => {
    const g = group.data;
    const members = new Set((g?.members ?? []).map((m) => m.userId));
    const choosable = (g?.members ?? [])
      .map((m) => users.get(m.userId))
      .filter((u) => u?.active)
      .map((u) => ({ value: u?.id ?? "", label: u?.name ?? "" }));
    const extra = (kept ? kept.split(",") : [])
      .filter((id) => !choosable.some((p) => p.value === id))
      .map((id) => {
        const u = users.get(id);
        const note = !u?.active
          ? text.inactive
          : !members.has(id)
            ? text.notMember
            : "";
        return { value: id, label: `${u?.name ?? id}${note && ` (${note})`}` };
      });
    const people = [...choosable, ...extra].sort((a, b) =>
      a.label.localeCompare(b.label, intlLocale(locale)),
    );
    return {
      group: g,
      isPending: group.isPending,
      people,
      peopleOrNone: [{ value: NONE, label: text.none }, ...people],
      postTypes: [
        { value: NONE, label: text.none },
        ...(g?.postTypes ?? []).map((t) => ({ value: t.id, label: t.name })),
      ],
      teams: [
        { value: NONE, label: text.none },
        ...(g?.teams ?? []).map((t) => ({ value: t.id, label: t.name })),
      ],
    };
  }, [group.data, group.isPending, users, kept, text, locale]);
}

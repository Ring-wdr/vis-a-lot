// 사용자 전환 메뉴에 붙이는 역할 설명.

import type { FeedUser, GroupDetail } from "@/shared/api/feed/types";

/** 사용자 id → 그룹 관리자인 그룹 이름들 */
export function adminGroupsByUser(groups: GroupDetail[]) {
  const map = new Map<string, string[]>();
  for (const g of groups)
    for (const m of g.members)
      if (m.role === "admin")
        map.set(m.userId, [...(map.get(m.userId) ?? []), g.name]);
  return map;
}

export function roleHint(user: FeedUser, adminOf: string[] = []) {
  if (user.isAdmin) return "시스템 관리자";
  if (adminOf.length) return `그룹 관리자 · ${adminOf.join(", ")}`;
  return "멤버";
}

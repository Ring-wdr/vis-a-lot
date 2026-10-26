// 처음 열었거나 저장해 둔 사용자가 없어졌을 때 고를 사용자.

import type { FeedUser } from "../api/types";

export const DEFAULT_USER_ID = "u1";

/** 저장한 사용자가 활성이면 그대로, 아니면 u1, 없으면 첫 활성 사용자. 활성 사용자가 없으면 null */
export function resolveCurrentUser(
  users: FeedUser[],
  storedId: string | null,
): string | null {
  const active = users.filter((u) => u.active);
  if (storedId && active.some((u) => u.id === storedId)) return storedId;
  return (
    active.find((u) => u.id === DEFAULT_USER_ID)?.id ?? active[0]?.id ?? null
  );
}

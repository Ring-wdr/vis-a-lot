"use client";

// id로 사용자·그룹을 찾는 표. 게시물은 사람·그룹을 id로만 주므로 화면이 이 표로 이름을 붙인다.

import { useMemo } from "react";
import { useGroups, useUsers } from "./queries";
import type { FeedUser, Group } from "./types";

export function useUserMap() {
  const users = useUsers().data;
  return useMemo(
    () => new Map<string, FeedUser>(users?.map((u) => [u.id, u])),
    [users],
  );
}

export function useGroupMap() {
  const groups = useGroups().data;
  return useMemo(
    () => new Map<string, Group>(groups?.map((g) => [g.id, g])),
    [groups],
  );
}

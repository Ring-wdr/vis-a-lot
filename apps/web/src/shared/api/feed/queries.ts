"use client";

// 피드 서버 상태 (TanStack Query). 모든 key는 ['feed', ...] 아래에 두어 한 번에 버리거나 다시 받는다.

import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNow } from "@/shared/lib/use-now";
import { groupsApi } from "./groups";
import { type InboxParams, notificationsApi } from "./notifications";
import { postsApi } from "./posts";
import { schedulerApi } from "./scheduler";
import { seedApi } from "./seed";
import { systemApi } from "./system";
import type { FeedSnapshot } from "./types";
import { usersApi } from "./users";

export const feedKeys = {
  all: ["feed"] as const,
  /** 사용자 목록. 사용자를 바꿔도 같으므로 바꿀 때 버리지 않는다 (resetFeedForUser) */
  users: ["feed", "users"] as const,
  me: ["feed", "me"] as const,
  groups: ["feed", "groups"] as const,
  group: (groupId: string) => ["feed", "groups", groupId] as const,
  notifications: ["feed", "notifications"] as const,
  unreadCount: ["feed", "notifications", "unread-count"] as const,
  inbox: (params: InboxParams) =>
    ["feed", "notifications", "inbox", params] as const,
  mySummary: ["feed", "posts", "my-summary"] as const,
  outbox: ["feed", "outbox"] as const,
  clock: ["feed", "system", "clock"] as const,
  status: ["feed", "system", "status"] as const,
};

export const usersQuery = queryOptions({
  queryKey: feedKeys.users,
  queryFn: usersApi.list,
  select: (r) => r.users,
  // 화면 여러 곳이 같은 목록을 본다. 실패했을 때 붙을 때마다 다시 부르지 않는다 (다시 시도 버튼으로).
  retryOnMount: false,
});

export const useUsers = () => useQuery(usersQuery);

export const useMe = () =>
  useQuery({ queryKey: feedKeys.me, queryFn: usersApi.me });

export const useGroups = () =>
  useQuery({
    queryKey: feedKeys.groups,
    queryFn: groupsApi.list,
    select: (r) => r.groups,
  });

const groupQuery = (groupId: string) =>
  queryOptions({
    queryKey: feedKeys.group(groupId),
    queryFn: () => groupsApi.get(groupId),
  });

export const useGroup = (groupId: string | undefined) =>
  useQuery({ ...groupQuery(groupId ?? ""), enabled: !!groupId });

/** 여러 그룹의 상세(멤버 역할 등). enabled가 거짓이면 받지 않는다. */
export function useGroupDetails(groupIds: string[], enabled = true) {
  return useQueries({
    queries: groupIds.map((id) => ({ ...groupQuery(id), enabled })),
  });
}

export const useUnreadCount = () =>
  useQuery({
    queryKey: feedKeys.unreadCount,
    queryFn: notificationsApi.unreadCount,
    select: (r) => r.count,
  });

export const useInbox = (params: InboxParams = {}) =>
  useQuery({
    queryKey: feedKeys.inbox(params),
    queryFn: () => notificationsApi.inbox(params),
  });

export const useMySummary = () =>
  useQuery({ queryKey: feedKeys.mySummary, queryFn: postsApi.mySummary });

export const useOutbox = () =>
  useQuery({
    queryKey: feedKeys.outbox,
    queryFn: notificationsApi.outbox,
    select: (r) => r.messages,
  });

export const useClock = () =>
  useQuery({ queryKey: feedKeys.clock, queryFn: systemApi.clock });

/** 피드의 "지금" (/feed/dev/clock 오프셋 반영). "5분 전" 같은 표시가 흐르도록 1분마다 다시 그린다. */
export function useFeedNow() {
  const offset = useClock().data?.offsetMs ?? 0;
  return useNow(60_000) + offset;
}

export const useFeedStatus = () =>
  useQuery({ queryKey: feedKeys.status, queryFn: systemApi.status });

/** 데이터나 "지금"이 통째로 바뀐 뒤: 피드 query를 모두 다시 받는다. */
export const invalidateFeed = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: feedKeys.all });

/**
 * 사용자를 바꾼 뒤: 사용자 목록만 남기고 피드 캐시를 비운다.
 * 이전 사용자의 알림·권한이 잠깐이라도 보이지 않게 invalidate 대신 reset한다.
 */
export const resetFeedForUser = (client: QueryClient) =>
  client.resetQueries({
    predicate: (q) => q.queryKey[0] === "feed" && q.queryKey[1] !== "users",
  });

/** scheduler를 한 번 돌리고, 알림이 생겼으면 알림 query를 다시 받는다. 실패는 조용히 넘긴다. */
export async function runSchedulerOnce(client: QueryClient) {
  try {
    const r = await schedulerApi.run();
    if (r.dueSoon || r.overdue || r.resumed)
      await client.invalidateQueries({ queryKey: feedKeys.notifications });
    return r;
  } catch {
    return null;
  }
}

/** 시계 오프셋을 바꾸고 피드 전체를 다시 받은 뒤 scheduler를 한 번 돌린다. */
export function useSetClock() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: systemApi.setClock,
    onSuccess: async (clock) => {
      client.setQueryData(feedKeys.clock, clock);
      await invalidateFeed(client);
      await runSchedulerOnce(client);
    },
  });
}

/** 피드 DB를 지우고 기본 시나리오를 다시 적재한다. */
export function useResetFeed() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: systemApi.reset,
    onSuccess: () => invalidateFeed(client),
  });
}

export function useImportSeed() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (snapshot: FeedSnapshot) => seedApi.import(snapshot),
    onSuccess: () => invalidateFeed(client),
  });
}

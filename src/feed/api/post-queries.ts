"use client";

// 게시물·뷰 서버 상태. 게시물을 바꾼 뒤에는 invalidatePosts로 목록·상세·요약·알림을 함께 다시 받는다.

import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { importsApi } from "./imports";
import { postsApi } from "./posts";
import { feedKeys } from "./queries";
import type { PostQueryRequest, SaveViewRequest } from "./types";
import { viewsApi } from "./views";

export const postKeys = {
  all: ["feed", "posts"] as const,
  query: (req: PostQueryRequest) => ["feed", "posts", "query", req] as const,
  detail: (key: string) => ["feed", "posts", "detail", key] as const,
  events: (key: string) => ["feed", "posts", "events", key] as const,
  views: (groupId?: string) => ["feed", "views", groupId ?? null] as const,
  view: (viewId: string) => ["feed", "views", "one", viewId] as const,
  chartShare: (shareId: string) =>
    ["feed", "imports", "chart-share", shareId] as const,
};

/** 게시물 목록. 필터를 바꾸는 동안 이전 결과를 보여준다 */
export const usePostQuery = (req: PostQueryRequest, enabled = true) =>
  useQuery({
    queryKey: postKeys.query(req),
    queryFn: () => postsApi.query(req),
    placeholderData: keepPreviousData,
    enabled,
  });

/** 게시물 하나 (id 또는 이슈 키) */
export const usePost = (key: string | null | undefined) =>
  useQuery({
    queryKey: postKeys.detail(key ?? ""),
    queryFn: () => postsApi.get(key ?? ""),
    enabled: !!key,
  });

export const usePostEvents = (key: string | null | undefined) =>
  useQuery({
    queryKey: postKeys.events(key ?? ""),
    queryFn: () => postsApi.events(key ?? ""),
    enabled: !!key,
    select: (r) => r.events,
  });

/** 게시물을 바꾼 뒤: 목록·상세·이력·내 작업 요약·알림을 다시 받는다 */
export const invalidatePosts = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: postKeys.all }),
    client.invalidateQueries({ queryKey: feedKeys.notifications }),
  ]);

/** 게시물을 바꾸는 mutation. 성공하면 invalidatePosts */
export function usePostMutation<A, R>(fn: (args: A) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidatePosts(client),
  });
}

export const useViews = (groupId?: string) =>
  useQuery({
    queryKey: postKeys.views(groupId),
    queryFn: () => viewsApi.list(groupId),
    select: (r) => r.views,
  });

export const useView = (viewId: string | null | undefined) =>
  useQuery({
    queryKey: postKeys.view(viewId ?? ""),
    queryFn: () => viewsApi.get(viewId ?? ""),
    enabled: !!viewId,
  });

export function useSaveView() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveViewRequest) => viewsApi.save(body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["feed", "views"] }),
  });
}

export const useChartShareImport = (shareId: string | null | undefined) =>
  useQuery({
    queryKey: postKeys.chartShare(shareId ?? ""),
    queryFn: () => importsApi.chartShare(shareId ?? ""),
    enabled: !!shareId,
    staleTime: Number.POSITIVE_INFINITY,
  });

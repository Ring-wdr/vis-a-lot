"use client";

// 댓글 서버 상태. 댓글을 바꾸면 그 게시물의 댓글과 함께 invalidatePosts(댓글 수·활동 로그·알림)를 다시 받는다.

import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { commentsApi } from "./comments";
import { invalidatePosts } from "./post-queries";

export const commentKeys = {
  all: ["feed", "comments"] as const,
  list: (postKey: string) => ["feed", "comments", postKey] as const,
};

/** 게시물 하나의 스레드 (id 또는 이슈 키) */
export const useComments = (postKey: string | null | undefined) =>
  useQuery({
    queryKey: commentKeys.list(postKey ?? ""),
    queryFn: () => commentsApi.list(postKey ?? ""),
    enabled: !!postKey,
    select: (r) => r.threads,
  });

/** 댓글을 바꾼 뒤: 댓글·게시물·알림을 다시 받는다 */
export const invalidateComments = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: commentKeys.all }),
    invalidatePosts(client),
  ]);

/** 댓글을 바꾸는 mutation. 성공하면 invalidateComments */
export function useCommentMutation<A, R>(fn: (args: A) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidateComments(client),
  });
}

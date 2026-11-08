"use client";

// 피드 search API: 커맨드 팔레트의 게시물 찾기.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { components } from "@/shared/api/generated/feed";
import { feedClient, unwrap } from "./client";

type Feed = components["schemas"];

export type SearchHit = Feed["SearchHit"];
export type SearchResponse = Feed["SearchResponse"];
export type SearchMatchedIn = SearchHit["matchedIn"];

export const searchApi = {
  posts: (q: string, limit?: number) =>
    unwrap(
      feedClient.GET("/search", {
        params: {
          query: { q, ...(limit !== undefined && { limit: String(limit) }) },
        },
      }),
    ),
};

export const searchKeys = {
  posts: (q: string) => ["feed", "search", q] as const,
};

/** 게시물 찾기. 빈 검색어면 부르지 않는다. 다음 결과가 올 때까지 이전 결과를 둔다 */
export const useSearchPosts = (q: string) => {
  const term = q.trim();
  return useQuery({
    queryKey: searchKeys.posts(term),
    queryFn: () => searchApi.posts(term),
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
    select: (r) => r.hits,
    staleTime: 10_000,
  });
};

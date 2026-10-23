// 상세 화면이 다루는 게시물. 생성 타입의 PostDetail은 parent(nullable 참조)가 `PostRef & (Record<string, never> | null)`로
// 나와 API 응답과 맞지 않으므로, 응답 타입을 그대로 쓴다.

import type { postsApi } from "@/feed/api/posts";

export type PostDetail = Awaited<ReturnType<typeof postsApi.get>>;

// 피드 서비스 API client. OAS에서 생성한 paths 타입으로 경로·파라미터·응답이 모두 타입 검사된다.

import createClient from "openapi-fetch";
import type { paths } from "@/shared/api/generated/feed";
import { currentUserStore } from "./current-user";

/** 서버의 server/services/feed/security.ts와 같은 이름 (화면은 서버 코드를 import하지 않는다) */
const FEED_USER_HEADER = "x-feed-user";

export const feedClient = createClient<paths>({ baseUrl: "/api/feed" });

feedClient.use({
  onRequest({ request }) {
    const userId = currentUserStore.getState().userId;
    if (userId) request.headers.set(FEED_USER_HEADER, userId);
    return request;
  },
});

export class FeedApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Result<T> = { data?: T; error?: unknown; response: Response };

/** 성공이면 body를, 아니면 서버가 준 사유로 FeedApiError를 던진다. */
export async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (response.ok) return data as T;
  const message =
    error && typeof error === "object" && "error" in error
      ? String(error.error)
      : `HTTP ${response.status}`;
  throw new FeedApiError(response.status, message);
}

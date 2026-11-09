// 피드 users API: 사용자 목록, 지금 사용자, 관리자 지정, 비활성화, 관심.

import { feedClient, unwrap } from "./client";

const user = (userId: string) => ({ params: { path: { userId } } });

export const usersApi = {
  list: () => unwrap(feedClient.GET("/users")),
  me: () => unwrap(feedClient.GET("/users/me")),
  setAdmin: (userId: string, on: boolean) =>
    unwrap(
      feedClient.PUT("/users/{userId}/admin", {
        ...user(userId),
        body: { on },
      }),
    ),
  deactivate: (userId: string) =>
    unwrap(feedClient.POST("/users/{userId}/deactivate", user(userId))),
  follow: (userId: string, on: boolean) =>
    unwrap(
      feedClient.PUT("/users/{userId}/follow", {
        ...user(userId),
        body: { on },
      }),
    ),
};

"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { resolveCurrentUser } from "@/entities/user/model/default-user";
import {
  currentUserStore,
  useCurrentUserId,
} from "@/shared/api/feed/current-user";
import { usersQuery } from "@/shared/api/feed/queries";
import { systemApi } from "@/shared/api/feed/system";
import { FeedBootScreen } from "./FeedBootScreen";
import { FeedShell } from "./FeedShell";

// 부트스트랩은 앱이 뜰 때 한 번만 부른다. 피드 query를 통째로 다시 받을 때(['feed', ...]) 함께 다시 불리지 않게
// key를 'feed' 밖에 두고, 한 번 성공하면 다시 부르지 않는다.
const bootstrapQuery = queryOptions({
  queryKey: ["feed-bootstrap"],
  queryFn: systemApi.bootstrap,
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
});

/**
 * 피드 데이터를 준비한다: 비어 있으면 기본 시나리오를 적재하고, 사용자 목록을 받아
 * 저장한 사용자가 없거나 비활성이면 기본 사용자를 고른다. 로그인은 없다.
 */
export function FeedBoot({ children }: { children: ReactNode }) {
  const boot = useQuery(bootstrapQuery);
  const ready = boot.isSuccess;
  // 기본 시나리오를 적재한 뒤에 사용자 목록을 받는다.
  const users = useQuery({ ...usersQuery, enabled: ready });
  const userId = useCurrentUserId();
  const resolved = users.data ? resolveCurrentUser(users.data, userId) : null;

  useEffect(() => {
    if (resolved && resolved !== userId)
      currentUserStore.getState().setUserId(resolved);
  }, [resolved, userId]);

  // 다시 시도하는 동안은 부팅 화면을 보여 준다.
  if (boot.isError && !boot.isFetching)
    return (
      <FeedBootScreen
        message="피드 데이터 준비"
        error={boot.error.message}
        onRetry={() => boot.refetch()}
      />
    );
  // v5에서는 데이터 없이 실패한 query에 observer가 새로 붙으면 pending으로 돌아가므로,
  // 한 번 결과(성공·실패)가 난 뒤에는 부팅 화면으로 되돌아가지 않는다.
  const settled = users.data !== undefined || users.errorUpdatedAt > 0;
  if (!ready || !settled)
    return <FeedBootScreen message="피드 데이터를 준비하는 중" />;
  if (resolved && resolved !== userId)
    return <FeedBootScreen message="사용자를 고르는 중" />;

  // 사용자 목록을 못 받아도 화면 틀은 띄운다 (서버 모듈이 아직 없을 때 등).
  const problem = !users.data
    ? users.isError
      ? `사용자 목록을 불러오지 못했습니다: ${users.error.message}`
      : "사용자 목록을 다시 불러오는 중"
    : !resolved
      ? "고를 수 있는 활성 사용자가 없습니다."
      : null;
  return (
    <FeedShell
      notice={
        problem && (
          <p
            role="alert"
            className="border-b border-line bg-danger/12 px-4 py-2 text-ui text-danger"
          >
            {problem}
            <button
              type="button"
              className="ml-2 cursor-pointer underline"
              disabled={users.isFetching}
              onClick={() => users.refetch()}
            >
              다시 시도
            </button>
          </p>
        )
      }
    >
      {children}
    </FeedShell>
  );
}

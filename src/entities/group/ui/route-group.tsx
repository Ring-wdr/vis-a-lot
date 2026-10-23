"use client";

// ?g=<키>로 고른 그룹. 리스트·보드가 함께 쓴다. 없거나 볼 수 없는 그룹이면 홈으로 가는 빈 화면을 보인다.

import { FolderX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useGroup, useGroups, useUsers } from "@/shared/api/feed/queries";
import type { FeedUser } from "@/shared/api/feed/types";
import { FEED } from "@/shared/config/feed-routes";
import { button } from "@/shared/ui/button";
import { EmptyState, Skeleton } from "@/shared/ui/Loading";

export function useRouteGroup() {
  const key = useSearchParams().get("g");
  const groups = useGroups();
  const group = key
    ? groups.data?.find((g) => g.keyPrefix === key || g.id === key)
    : undefined;
  const detail = useGroup(group?.id);
  const users = useUsers();
  /** 필터·일괄 변경에서 고를 사람: 그룹 멤버 (상세를 아직 못 받았으면 활성 사용자 전체) */
  const members = useMemo<FeedUser[]>(() => {
    const all = (users.data ?? []).filter((u) => u.active);
    const ids = detail.data?.members.map((m) => m.userId);
    return ids ? all.filter((u) => ids.includes(u.id)) : all;
  }, [users.data, detail.data]);
  return { key, groups, group, detail: detail.data, members };
}

/** 그룹을 고르기 전 상태: 불러오는 중 / 오류 / 없음. 그룹이 있으면 null */
export function RouteGroupFallback({
  state,
}: {
  state: ReturnType<typeof useRouteGroup>;
}) {
  const { key, groups, group } = state;
  if (group) return null;
  if (groups.isPending)
    return (
      <div className="flex flex-col gap-3 p-6" aria-busy="true">
        <Skeleton width={30} className="h-5" />
        <Skeleton width={90} />
        <Skeleton width={70} />
      </div>
    );
  if (groups.isError)
    return (
      <EmptyState
        icon={<FolderX size={20} />}
        title="그룹을 불러오지 못했습니다"
      >
        <p>{groups.error.message}</p>
        <button
          type="button"
          className={button({ size: "sm", class: "mt-2" })}
          onClick={() => groups.refetch()}
        >
          다시 시도
        </button>
      </EmptyState>
    );
  return (
    <EmptyState
      icon={<FolderX size={20} />}
      title={key ? `‘${key}’ 그룹을 찾을 수 없습니다` : "그룹을 고르세요"}
    >
      <p>
        {key
          ? "없는 그룹이거나, 비공개 그룹이라 볼 수 없습니다."
          : "사이드바에서 그룹의 리스트나 보드를 고르세요."}
      </p>
      <Link
        href={FEED.home}
        className={button({ size: "sm", class: "mt-2 no-underline" })}
      >
        홈으로
      </Link>
    </EmptyState>
  );
}

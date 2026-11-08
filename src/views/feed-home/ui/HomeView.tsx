"use client";

// 홈 피드 (/feed): 내 작업 요약 띠 + 그룹 탭(?g=KEY) + 카드 피드. 끌어올린 게시물이 먼저 온다.

import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PostCard } from "@/entities/post/ui/PostCard";
import { PinButton } from "@/features/pin-post/ui/PinButton";
import { usePostQuery } from "@/shared/api/feed/post-queries";
import { useGroups } from "@/shared/api/feed/queries";
import type { Group } from "@/shared/api/feed/types";
import { FEED } from "@/shared/config/feed-routes";
import { inAllLocales } from "@/shared/lib/lingui";
import { useOpenPeek } from "@/shared/lib/peek";
import { button } from "@/shared/ui/button";
import { EmptyState, LoadingText, Skeleton } from "@/shared/ui/Loading";
import { StableText } from "@/shared/ui/StableText";
import { tabStyles, useQueryHref } from "@/shared/ui/tabs";
import "../config/messages";
import { MySummaryStrip } from "./MySummaryStrip";

const PAGE = 24;
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3";
const tabs = tabStyles();
const ALL = msg`전체`;

function GroupTabs({
  groups,
  current,
}: {
  groups: Group[];
  current: string | null;
}) {
  const { t } = useLingui();
  const href = useQueryHref();
  return (
    <nav aria-label={t`그룹`} className={tabs.list()}>
      <Link
        href={href({ g: null })}
        className={tabs.tab()}
        aria-current={current === null ? "page" : undefined}
      >
        <StableText {...inAllLocales(ALL)} />
      </Link>
      {groups.map((g) => (
        <Link
          key={g.id}
          href={href({ g: g.keyPrefix })}
          className={tabs.tab()}
          aria-current={current === g.keyPrefix ? "page" : undefined}
        >
          {g.name}
          <span className="font-mono text-2xs text-fg-muted">
            {g.keyPrefix}
          </span>
        </Link>
      ))}
    </nav>
  );
}

function CardSkeletons() {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: 자리만 잡는 고정 목록
          key={i}
          className="flex flex-col gap-2 rounded-lg border border-line bg-elevated p-3"
        >
          <Skeleton className="h-28" />
          <Skeleton width={70} />
          <Skeleton width={50} />
        </div>
      ))}
    </div>
  );
}

/** 카드 목록. 그룹이 바뀌면 key로 새로 그려 "더 보기"를 처음부터 */
function CardFeed({ groupIds }: { groupIds?: string[] }) {
  const { t } = useLingui();
  const [limit, setLimit] = useState(PAGE);
  const openPeek = useOpenPeek();
  const query = usePostQuery({
    filter: groupIds ? { groupIds } : {},
    sort: { field: "updatedAt", dir: "desc" },
    pinnedFirst: true,
    offset: 0,
    limit,
  });

  if (query.isPending) return <CardSkeletons />;
  if (query.isError) {
    const reason = query.error.message;
    return (
      <div className="flex flex-col items-start gap-2 p-4">
        <p role="alert" className="text-ui text-danger">
          {t`게시물을 불러오지 못했습니다 (${reason})`}
        </p>
        <button
          type="button"
          className={button({ size: "sm" })}
          onClick={() => query.refetch()}
        >
          <Trans>다시 시도</Trans>
        </button>
      </div>
    );
  }

  const { posts, total } = query.data;
  if (posts.length === 0)
    return (
      <EmptyState icon={<Inbox size={20} />} title={t`게시물이 없습니다`}>
        <Link href={FEED.new} className="text-accent">
          <Trans>새 게시물 만들기</Trans>
        </Link>
      </EmptyState>
    );

  return (
    <div className="flex flex-col gap-4">
      <ul className={GRID} aria-label={t`게시물`}>
        {posts.map((post) => (
          <li key={post.id} className="min-w-0">
            <PostCard
              post={post}
              onOpen={openPeek}
              actions={<PinButton post={post} />}
            />
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-center gap-3 text-xs text-fg-muted">
        <span className="tabular-nums">
          {posts.length} / {total}
        </span>
        {posts.length < total && (
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={query.isFetching}
            onClick={() => setLimit((n) => n + PAGE)}
          >
            {query.isFetching ? (
              <LoadingText>
                <Trans>불러오는 중</Trans>
              </LoadingText>
            ) : (
              <Trans>더 보기</Trans>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function HomeView() {
  const { t } = useLingui();
  const groups = useGroups();
  const g = useSearchParams().get("g");
  const group = g ? groups.data?.find((x) => x.keyPrefix === g) : undefined;
  const groupsError = groups.error?.message;

  return (
    <div className="mx-auto flex w-full max-w-300 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-bold">
        <Trans>홈</Trans>
      </h1>
      <MySummaryStrip />
      <GroupTabs groups={groups.data ?? []} current={g} />
      {groups.isError && (
        <p className="text-xs text-danger">
          {t`그룹을 불러오지 못했습니다 (${groupsError})`}
        </p>
      )}
      {g && groups.isPending ? (
        <CardSkeletons />
      ) : g && !group ? (
        <EmptyState icon={<Inbox size={20} />} title={t`모르는 그룹입니다`}>
          <Link href={FEED.home} className="text-accent">
            <Trans>전체 보기</Trans>
          </Link>
        </EmptyState>
      ) : (
        <CardFeed key={group?.id ?? "all"} groupIds={group && [group.id]} />
      )}
    </div>
  );
}

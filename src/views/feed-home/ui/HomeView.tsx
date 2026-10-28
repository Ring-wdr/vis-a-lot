"use client";

// 홈 피드 (/feed): 내 작업 요약 띠 + 그룹 탭(?g=KEY) + 카드 피드. 끌어올린 게시물이 먼저 온다.

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
import { useLocale } from "@/shared/lib/i18n";
import * as m from "@/shared/lib/paraglide/messages/_index.js";
import { useOpenPeek } from "@/shared/lib/peek";
import { button } from "@/shared/ui/button";
import { EmptyState, LoadingText, Skeleton } from "@/shared/ui/Loading";
import { StableMessage } from "@/shared/ui/StableText";
import { tabStyles, useQueryHref } from "@/shared/ui/tabs";
import { MySummaryStrip } from "./MySummaryStrip";

const PAGE = 24;
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3";
const tabs = tabStyles();

function GroupTabs({
  groups,
  current,
}: {
  groups: Group[];
  current: string | null;
}) {
  const o = { locale: useLocale() };
  const href = useQueryHref();
  return (
    <nav aria-label={m.feed_home_groups({}, o)} className={tabs.list()}>
      <Link
        href={href({ g: null })}
        className={tabs.tab()}
        aria-current={current === null ? "page" : undefined}
      >
        <StableMessage message={m.feed_home_all} />
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
  const o = { locale: useLocale() };
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
  if (query.isError)
    return (
      <div className="flex flex-col items-start gap-2 p-4">
        <p role="alert" className="text-ui text-danger">
          {m.feed_home_load_failed({ reason: query.error.message }, o)}
        </p>
        <button
          type="button"
          className={button({ size: "sm" })}
          onClick={() => query.refetch()}
        >
          {m.feed_home_retry({}, o)}
        </button>
      </div>
    );

  const { posts, total } = query.data;
  if (posts.length === 0)
    return (
      <EmptyState icon={<Inbox size={20} />} title={m.feed_home_empty({}, o)}>
        <Link href={FEED.new} className="text-accent">
          {m.feed_home_new_post({}, o)}
        </Link>
      </EmptyState>
    );

  return (
    <div className="flex flex-col gap-4">
      <ul className={GRID} aria-label={m.feed_home_posts({}, o)}>
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
              <LoadingText>{m.feed_home_loading({}, o)}</LoadingText>
            ) : (
              m.feed_home_more({}, o)
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function HomeView() {
  const o = { locale: useLocale() };
  const groups = useGroups();
  const g = useSearchParams().get("g");
  const group = g ? groups.data?.find((x) => x.keyPrefix === g) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-300 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-bold">{m.feed_home_home({}, o)}</h1>
      <MySummaryStrip />
      <GroupTabs groups={groups.data ?? []} current={g} />
      {groups.isError && (
        <p className="text-xs text-danger">
          {m.feed_home_groups_failed({ reason: groups.error.message }, o)}
        </p>
      )}
      {g && groups.isPending ? (
        <CardSkeletons />
      ) : g && !group ? (
        <EmptyState
          icon={<Inbox size={20} />}
          title={m.feed_home_unknown_group({}, o)}
        >
          <Link href={FEED.home} className="text-accent">
            {m.feed_home_show_all({}, o)}
          </Link>
        </EmptyState>
      ) : (
        <CardFeed key={group?.id ?? "all"} groupIds={group && [group.id]} />
      )}
    </div>
  );
}

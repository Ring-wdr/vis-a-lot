"use client";

// 내 작업 (/feed/my): 담당·내가 요청·승인 대기·이해관계자 탭(?tab=), 기한순 표. 기본은 열림·멈춤만(?closed=1이면 닫힌 것도).

import { ClipboardList, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  addDays,
  DUE_SOON_DAYS,
  localToday,
  type MyTab,
  myFilter,
  myTabs,
  parseTab,
} from "@/entities/post/lib/my-work";
import { PostTable } from "@/entities/post/ui/PostTable";
import { usePostQuery } from "@/shared/api/feed/post-queries";
import { useClock } from "@/shared/api/feed/queries";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { useOpenPeek } from "@/shared/lib/peek";
import { button } from "@/shared/ui/button";
import { EmptyState, LoadingText } from "@/shared/ui/Loading";
import { tabStyles, useQueryHref, useReplaceQuery } from "@/shared/ui/tabs";

const LIMIT = 500;
const COLUMNS = [
  "key",
  "title",
  "status",
  "priority",
  "assignee",
  "dueDate",
  "updatedAt",
] as const;
const SORT = { field: "dueDate", dir: "asc" } as const;
const tabs = tabStyles();

const messages = defineMessages({
  ko: {
    countUnit: "개",
    title: "내 작업",
    tabsLabel: "내 작업 탭",
    includeClosed: "닫힌 것 포함",
    dueSoonOnly: (days: number) => `기한 임박만 (${days}일 안·지남)`,
    clearDueSoon: "기한 임박 거르기 해제",
    sortedByDue: "기한이 이른 순",
    loadFailed: (reason: string) => `목록을 불러오지 못했습니다 (${reason})`,
    retry: "다시 시도",
    loading: "목록을 불러오는 중",
    empty: "해당하는 게시물이 없습니다",
    emptyHint: "닫힌 것 포함을 켜면 끝난 일도 보입니다.",
    truncated: (total: number, shown: number) =>
      `${total}개 중 ${shown}개만 보여줍니다`,
  },
  en: {
    countUnit: " posts",
    title: "My work",
    tabsLabel: "My work tabs",
    includeClosed: "Include closed",
    dueSoonOnly: (days: number) => `Due soon only (within ${days}d or overdue)`,
    clearDueSoon: "Clear due-soon filter",
    sortedByDue: "Earliest due first",
    loadFailed: (reason: string) => `Couldn't load the list (${reason})`,
    retry: "Retry",
    loading: "Loading list",
    empty: "No matching posts",
    emptyHint: "Turn on Include closed to see finished work too.",
    truncated: (total: number, shown: number) => `Showing ${shown} of ${total}`,
  },
});

/** 탭 이름 옆 개수. limit 1로 total만 받는다 */
function TabCount({
  tab,
  includeClosed,
}: {
  tab: MyTab;
  includeClosed: boolean;
}) {
  const count = usePostQuery({
    filter: myFilter(tab, { includeClosed }),
    sort: SORT,
    pinnedFirst: false,
    offset: 0,
    limit: 1,
  });
  const text = useT(messages);
  if (count.data === undefined) return null;
  return (
    <span className={tabs.count()}>
      {count.data.total}
      <span className="sr-only">{text.countUnit}</span>
    </span>
  );
}

export function MyWorkView() {
  const text = useT(messages);
  const search = useSearchParams();
  const tab = parseTab(search.get("tab"));
  const includeClosed = search.get("closed") === "1";
  const dueSoon = search.get("due") === "soon";
  const clock = useClock();
  const href = useQueryHref();
  const replace = useReplaceQuery();
  const openPeek = useOpenPeek();

  // 기한 임박은 시계(오프셋 반영)를 받은 뒤에 거른다
  const dueSoonUntil =
    dueSoon && clock.data
      ? addDays(localToday(new Date(clock.data.now)), DUE_SOON_DAYS)
      : null;
  const query = usePostQuery(
    {
      filter: myFilter(tab, { includeClosed, dueSoonUntil }),
      sort: SORT,
      pinnedFirst: false,
      offset: 0,
      limit: LIMIT,
    },
    !dueSoon || !!dueSoonUntil,
  );

  return (
    <div className="mx-auto flex w-full max-w-300 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-bold">{text.title}</h1>
      <nav aria-label={text.tabsLabel} className={tabs.list()}>
        {myTabs().map((t) => (
          <Link
            key={t.id}
            href={href({ tab: t.id, due: null })}
            className={tabs.tab()}
            aria-current={t.id === tab ? "page" : undefined}
          >
            {t.label}
            <TabCount tab={t.id} includeClosed={includeClosed} />
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3 text-xs text-fg-secondary">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={includeClosed}
            disabled={dueSoon}
            onChange={(e) => replace({ closed: e.target.checked ? "1" : null })}
          />
          {text.includeClosed}
        </label>
        {dueSoon && (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-soft py-0.5 pr-1 pl-2 text-accent">
            {text.dueSoonOnly(DUE_SOON_DAYS)}
            <Link
              href={href({ due: null })}
              className="inline-grid size-4 place-items-center rounded-full text-accent hover:bg-accent-soft-strong"
              aria-label={text.clearDueSoon}
            >
              <X size={12} aria-hidden="true" />
            </Link>
          </span>
        )}
        <span className="ml-auto">{text.sortedByDue}</span>
      </div>

      {query.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-ui text-danger">
            {text.loadFailed(query.error.message)}
          </p>
          <button
            type="button"
            className={button({ size: "sm" })}
            onClick={() => query.refetch()}
          >
            {text.retry}
          </button>
        </div>
      ) : !query.data ? (
        <LoadingText>{text.loading}</LoadingText>
      ) : query.data.posts.length === 0 ? (
        <EmptyState icon={<ClipboardList size={20} />} title={text.empty}>
          {!includeClosed && !dueSoon && text.emptyHint}
        </EmptyState>
      ) : (
        <>
          <PostTable
            posts={query.data.posts}
            columns={COLUMNS}
            onOpen={openPeek}
          />
          {query.data.total > query.data.posts.length && (
            <p className="text-xs text-fg-muted">
              {text.truncated(query.data.total, query.data.posts.length)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

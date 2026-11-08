"use client";

// 내 작업 (/feed/my): 담당·내가 요청·승인 대기·이해관계자 탭(?tab=), 기한순 표. 기본은 열림·멈춤만(?closed=1이면 닫힌 것도).

import { Trans, useLingui } from "@lingui/react/macro";
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
import { useOpenPeek } from "@/shared/lib/peek";
import { button } from "@/shared/ui/button";
import { EmptyState, LoadingText } from "@/shared/ui/Loading";
import { tabStyles, useQueryHref, useReplaceQuery } from "@/shared/ui/tabs";
import "../config/messages";

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
  if (count.data === undefined) return null;
  return (
    <span className={tabs.count()}>
      {count.data.total}
      <span className="sr-only">
        <Trans
          context="unit after a tab's post count"
          comment="숫자 바로 뒤에 붙는다. 영어는 앞에 공백을 둔다"
        >
          개
        </Trans>
      </span>
    </span>
  );
}

export function MyWorkView() {
  const { t } = useLingui();
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

  const days = DUE_SOON_DAYS;
  const reason = query.error?.message;
  const total = query.data?.total ?? 0;
  const shown = query.data?.posts.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-300 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-bold">
        <Trans>내 작업</Trans>
      </h1>
      <nav aria-label={t`내 작업 탭`} className={tabs.list()}>
        {myTabs().map((item) => (
          <Link
            key={item.id}
            href={href({ tab: item.id, due: null })}
            className={tabs.tab()}
            aria-current={item.id === tab ? "page" : undefined}
          >
            {item.label}
            <TabCount tab={item.id} includeClosed={includeClosed} />
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
          <Trans>닫힌 것 포함</Trans>
        </label>
        {dueSoon && (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-soft py-0.5 pr-1 pl-2 text-accent">
            {t`기한 임박만 (${days}일 안·지남)`}
            <Link
              href={href({ due: null })}
              className="inline-grid size-4 place-items-center rounded-full text-accent hover:bg-accent-soft-strong"
              aria-label={t`기한 임박 거르기 해제`}
            >
              <X size={12} aria-hidden="true" />
            </Link>
          </span>
        )}
        <span className="ml-auto">
          <Trans>기한이 이른 순</Trans>
        </span>
      </div>

      {query.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-ui text-danger">
            {t`목록을 불러오지 못했습니다 (${reason})`}
          </p>
          <button
            type="button"
            className={button({ size: "sm" })}
            onClick={() => query.refetch()}
          >
            <Trans>다시 시도</Trans>
          </button>
        </div>
      ) : !query.data ? (
        <LoadingText>
          <Trans>목록을 불러오는 중</Trans>
        </LoadingText>
      ) : query.data.posts.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={20} />}
          title={t`해당하는 게시물이 없습니다`}
        >
          {!includeClosed && !dueSoon && (
            <Trans>닫힌 것 포함을 켜면 끝난 일도 보입니다.</Trans>
          )}
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
              {t`${total}개 중 ${shown}개만 보여줍니다`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

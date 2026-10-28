"use client";

// 리스트 (/feed/list?g=FD): 필터(URL) + 정렬·그룹핑·열 + 다중 선택 일괄 변경 + 뷰로 저장. 행을 누르면 옆 패널.

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { BookmarkPlus, ListX, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  RouteGroupFallback,
  useRouteGroup,
} from "@/entities/group/ui/route-group";
import { PostTable } from "@/entities/post/ui/PostTable";
import { TableSkeleton } from "@/entities/post/ui/TableSkeleton";
import { withGroup } from "@/features/filter-posts/model/filter-url";
import { useListState } from "@/features/filter-posts/model/use-list-state";
import { FilterBar } from "@/features/filter-posts/ui/FilterBar";
import {
  ColumnPick,
  GroupByPick,
  SortPick,
} from "@/features/filter-posts/ui/list-controls";
import { askSaveView } from "@/features/save-view/ui/save-view-dialog";
import { usePostQuery, useSaveView } from "@/shared/api/feed/post-queries";
import { FEED } from "@/shared/config/feed-routes";
import { useOpenPeek } from "@/shared/lib/peek";
import { showAlert } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/Loading";
import "../config/messages";
import { BulkBar } from "./BulkBar";

export function ListView() {
  const { t } = useLingui();
  const route = useRouteGroup();
  const { group, detail, members } = route;
  const [state, update] = useListState();
  const openPeek = useOpenPeek();
  const router = useRouter();
  const save = useSaveView();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const request = useMemo(
    () => ({
      filter: withGroup(state.filter, group?.id ?? ""),
      sort: state.sort,
      pinnedFirst: false,
      offset: 0,
      limit: 200,
    }),
    [state.filter, state.sort, group?.id],
  );
  const query = usePostQuery(request, !!group);
  const posts = query.data?.posts ?? [];

  if (!group) return <RouteGroupFallback state={route} />;

  const teams = detail?.teams ?? [];
  const postTypes = detail?.postTypes ?? [];
  const groupName = group.name;
  const total = query.data?.total ?? 0;
  const shown = posts.length;

  async function saveAsView() {
    if (!group) return;
    const answer = await askSaveView({
      defaultName: t({
        message: `${groupName} 리스트`,
        comment: "저장할 뷰의 기본 이름. {groupName}은 그룹 이름",
      }),
      groupName: group.name,
    });
    if (!answer) return;
    try {
      const view = await save.mutateAsync({
        groupId: group.id,
        name: answer.name,
        shared: answer.shared,
        layout: "list",
        filter: request.filter,
        sort: state.sort,
        groupBy: state.groupBy,
        pinned: false,
      });
      router.push(`${FEED.view}?id=${encodeURIComponent(view.id)}`);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      showAlert(t`뷰를 저장하지 못했습니다: ${reason}`);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{group.name}</h1>
        <span className="font-mono text-xs text-fg-muted">
          {group.keyPrefix}
        </span>
        <span className="text-xs text-fg-muted tabular-nums">
          {!query.data
            ? ""
            : total > shown
              ? t`${plural(total, { other: "#건" })} 중 ${shown}건 표시`
              : t`${plural(total, { other: "#건" })}`}
        </span>
        <button
          type="button"
          className={button({
            size: "sm",
            class: "ml-auto whitespace-nowrap",
          })}
          disabled={save.isPending}
          onClick={saveAsView}
        >
          <BookmarkPlus size={14} aria-hidden="true" />
          <Trans>뷰로 저장</Trans>
        </button>
      </header>

      <FilterBar
        filter={state.filter}
        onChange={(filter) => update({ filter })}
        users={members}
        teams={teams}
        postTypes={postTypes}
        statusNames={group.statusNames}
      />
      <div className="flex flex-wrap items-center gap-2">
        <GroupByPick
          value={state.groupBy}
          onChange={(groupBy) => update({ groupBy })}
        />
        <SortPick sort={state.sort} onChange={(sort) => update({ sort })} />
        <ColumnPick
          columns={state.columns}
          onChange={(columns) => update({ columns })}
        />
        {query.isFetching && !query.isPending && (
          <span className="text-2xs text-fg-muted">
            <Trans>새로 받는 중…</Trans>
          </span>
        )}
      </div>

      <BulkBar
        posts={posts}
        selected={selected}
        onSelectedChange={setSelected}
        users={members}
        teams={teams}
        postTypes={postTypes}
        statusNames={group.statusNames}
      />

      {query.isPending ? (
        <TableSkeleton />
      ) : query.isError ? (
        <EmptyState
          icon={<ListX size={20} />}
          title={t`게시물을 불러오지 못했습니다`}
        >
          <p>{query.error.message}</p>
          <button
            type="button"
            className={button({ size: "sm", class: "mt-2" })}
            onClick={() => query.refetch()}
          >
            <RefreshCw size={14} aria-hidden="true" />
            <Trans>다시 시도</Trans>
          </button>
        </EmptyState>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<ListX size={20} />}
          title={t`조건에 맞는 게시물이 없습니다`}
        >
          <p>
            <Trans>필터를 줄이거나 지워 보세요.</Trans>
          </p>
          <button
            type="button"
            className={button({ size: "sm", class: "mt-2" })}
            onClick={() => update({ filter: {} })}
          >
            <Trans>필터 지우기</Trans>
          </button>
        </EmptyState>
      ) : (
        <PostTable
          posts={posts}
          columns={state.columns}
          groupBy={state.groupBy}
          selected={selected}
          onSelectedChange={setSelected}
          onOpen={openPeek}
        />
      )}
    </div>
  );
}

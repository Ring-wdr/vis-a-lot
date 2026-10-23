"use client";

// 리스트 (/feed/list?g=FD): 필터(URL) + 정렬·그룹핑·열 + 다중 선택 일괄 변경 + 뷰로 저장. 행을 누르면 옆 패널.

import { BookmarkPlus, ListX, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { showAlert } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { EmptyState, Skeleton } from "@/shared/ui/Loading";
import { usePostQuery, useSaveView } from "../../api/post-queries";
import { useOpenPeek } from "../../lib/peek";
import { FEED } from "../../lib/routes";
import { FilterBar } from "../../ui/filter/FilterBar";
import { withGroup } from "../../ui/filter/filter-url";
import {
  ColumnPick,
  GroupByPick,
  SortPick,
} from "../../ui/filter/list-controls";
import { useListState } from "../../ui/filter/use-list-state";
import { PostTable } from "../../ui/posts/PostTable";
import { askSaveView } from "../saved-view/save-view-dialog";
import { BulkBar } from "./BulkBar";
import { RouteGroupFallback, useRouteGroup } from "./route-group";

/** 표 자리 잡기 */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-line bg-elevated p-3"
      aria-busy="true"
    >
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 자리 잡기 막대는 순서뿐이다
        <Skeleton key={i} width={i % 3 === 0 ? 70 : i % 3 === 1 ? 90 : 50} />
      ))}
    </div>
  );
}

export function ListView() {
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

  async function saveAsView() {
    if (!group) return;
    const answer = await askSaveView({
      defaultName: `${group.name} 리스트`,
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
      showAlert(
        `뷰를 저장하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`,
      );
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
          {query.data ? `${query.data.total}건` : ""}
          {query.data && query.data.total > posts.length
            ? ` 중 ${posts.length}건 표시`
            : ""}
        </span>
        <button
          type="button"
          className={button({ size: "sm", class: "ml-auto" })}
          disabled={save.isPending}
          onClick={saveAsView}
        >
          <BookmarkPlus size={14} aria-hidden="true" />
          뷰로 저장
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
          <span className="text-2xs text-fg-muted">새로 받는 중…</span>
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
          title="게시물을 불러오지 못했습니다"
        >
          <p>{query.error.message}</p>
          <button
            type="button"
            className={button({ size: "sm", class: "mt-2" })}
            onClick={() => query.refetch()}
          >
            <RefreshCw size={14} aria-hidden="true" />
            다시 시도
          </button>
        </EmptyState>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<ListX size={20} />}
          title="조건에 맞는 게시물이 없습니다"
        >
          <p>필터를 줄이거나 지워 보세요.</p>
          <button
            type="button"
            className={button({ size: "sm", class: "mt-2" })}
            onClick={() => update({ filter: {} })}
          >
            필터 지우기
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

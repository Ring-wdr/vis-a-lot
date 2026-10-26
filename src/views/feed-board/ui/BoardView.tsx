"use client";

// 보드 (/feed/board?g=FD): 상태 열 칸반. 필터는 리스트와 같은 URL 규칙, 스윔레인은 ?lane=team.

import { Columns3, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  RouteGroupFallback,
  useRouteGroup,
} from "@/entities/group/ui/route-group";
import { withGroup } from "@/features/filter-posts/model/filter-url";
import { useListState } from "@/features/filter-posts/model/use-list-state";
import { FilterBar } from "@/features/filter-posts/ui/FilterBar";
import { usePostQuery } from "@/shared/api/feed/post-queries";
import { useOpenPeek } from "@/shared/lib/peek";
import { button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/Loading";
import { segmented } from "@/shared/ui/segmented";
import { BoardSkeleton } from "@/widgets/post-board/ui/BoardSkeleton";
import { PostBoard } from "@/widgets/post-board/ui/PostBoard";

const seg = segmented();

function useLane() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const lane = search.get("lane") === "team" ? "team" : null;
  const setLane = (next: "team" | null) => {
    const q = new URLSearchParams(search);
    if (next) q.set("lane", next);
    else q.delete("lane");
    router.replace(`${pathname}?${q}`, { scroll: false });
  };
  return [lane, setLane] as const;
}

export function BoardView() {
  const route = useRouteGroup();
  const { group, detail, members } = route;
  const [state, update] = useListState();
  const [lane, setLane] = useLane();
  const openPeek = useOpenPeek();

  const request = useMemo(
    () => ({
      filter: withGroup(state.filter, group?.id ?? ""),
      sort: state.sort,
      pinnedFirst: false,
      offset: 0,
      limit: 500,
    }),
    [state.filter, state.sort, group?.id],
  );
  const query = usePostQuery(request, !!group);

  if (!group) return <RouteGroupFallback state={route} />;

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{group.name} 보드</h1>
        <span className="font-mono text-xs text-fg-muted">
          {group.keyPrefix}
        </span>
        <span className="text-xs text-fg-muted tabular-nums">
          {query.data ? `${query.data.total}건` : ""}
        </span>
        <fieldset className="ml-auto inline-flex items-center gap-1.5">
          <legend className="sr-only">스윔레인</legend>
          <span className="text-xs text-fg-muted" aria-hidden="true">
            스윔레인
          </span>
          <span className={seg.root({ class: "self-auto" })}>
            <button
              type="button"
              className={seg.item()}
              aria-pressed={!lane}
              onClick={() => setLane(null)}
            >
              없음
            </button>
            <button
              type="button"
              className={seg.item()}
              aria-pressed={lane === "team"}
              onClick={() => setLane("team")}
            >
              팀
            </button>
          </span>
        </fieldset>
      </header>

      <FilterBar
        compact
        filter={state.filter}
        onChange={(filter) => update({ filter })}
        users={members}
        teams={detail?.teams}
        postTypes={detail?.postTypes}
        statusNames={group.statusNames}
      />

      {query.isPending ? (
        <BoardSkeleton />
      ) : query.isError ? (
        <EmptyState
          icon={<Columns3 size={20} />}
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
      ) : (
        <>
          {query.data.posts.length === 0 && (
            <p className="text-xs text-fg-muted">
              조건에 맞는 게시물이 없습니다. 필터를 줄여 보세요.
            </p>
          )}
          <PostBoard
            posts={query.data.posts}
            groupId={group.id}
            swimlane={lane}
            teams={detail?.teams}
            onOpen={openPeek}
          />
        </>
      )}
    </div>
  );
}

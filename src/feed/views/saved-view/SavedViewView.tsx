"use client";

// 저장된 뷰 (/feed/view?id=…): 저장한 필터·정렬로 받아 피드·리스트·보드로 보인다.
// 표시 방식·그룹핑은 저장하기 전까지 이 화면에서만 바뀐다.

import { useQueryClient } from "@tanstack/react-query";
import {
  BookmarkX,
  Copy,
  LayoutGrid,
  Pin,
  PinOff,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/shared/lib/tw";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { EmptyState, Skeleton } from "@/shared/ui/Loading";
import { segmented } from "@/shared/ui/segmented";
import { FeedApiError } from "../../api/client";
import { useGroupMap } from "../../api/lookups";
import { usePostQuery, useSaveView, useView } from "../../api/post-queries";
import type { SavedView, ViewGroupBy, ViewLayout } from "../../api/types";
import { viewsApi } from "../../api/views";
import { useOpenPeek } from "../../lib/peek";
import { FEED } from "../../lib/routes";
import { DEFAULT_SORT } from "../../ui/filter/filter-url";
import { GroupByPick } from "../../ui/filter/list-controls";
import { PostBoard } from "../../ui/posts/PostBoard";
import { PostCard } from "../../ui/posts/PostCard";
import { PostTable } from "../../ui/posts/PostTable";
import { BoardSkeleton } from "../board/BoardView";
import { TableSkeleton } from "../list/ListView";
import { askSaveView } from "./save-view-dialog";

const seg = segmented();

const LAYOUTS: { value: ViewLayout; label: string }[] = [
  { value: "feed", label: "피드" },
  { value: "list", label: "리스트" },
  { value: "board", label: "보드" },
];

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

function HomeLink() {
  return (
    <Link
      href={FEED.home}
      className={button({ size: "sm", class: "mt-2 no-underline" })}
    >
      홈으로
    </Link>
  );
}

function ViewBadge({ view }: { view: SavedView }) {
  const label = view.builtin ? "기본 제공" : view.shared ? "그룹 공유" : "개인";
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm px-1.5 text-2xs font-semibold",
        view.shared
          ? "bg-accent-soft text-accent"
          : "bg-panel-strong text-fg-secondary",
      )}
    >
      {label}
    </span>
  );
}

const SKELETON_CARDS = ["a", "b", "c", "d", "e", "f"];

function CardGridSkeleton() {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3"
      aria-busy="true"
    >
      {SKELETON_CARDS.map((k) => (
        <div
          key={k}
          className="flex flex-col gap-2 rounded-lg border border-line p-3"
        >
          <Skeleton className="aspect-16/10 h-auto" />
          <Skeleton width={90} />
          <Skeleton width={50} />
        </div>
      ))}
    </div>
  );
}

function ViewBody({ view }: { view: SavedView }) {
  const client = useQueryClient();
  const router = useRouter();
  const openPeek = useOpenPeek();
  const groups = useGroupMap();
  const save = useSaveView();
  const [layout, setLayout] = useState<ViewLayout>(view.layout);
  const [groupBy, setGroupBy] = useState<ViewGroupBy>(view.groupBy);
  const [busy, setBusy] = useState(false);

  const query = usePostQuery({
    filter: view.filter,
    sort: view.sort ?? DEFAULT_SORT,
    pinnedFirst: false,
    offset: 0,
    limit: layout === "board" ? 500 : 200,
  });
  const posts = query.data?.posts ?? [];
  const group = view.groupId ? groups.get(view.groupId) : undefined;
  const canEdit = view.editable && !view.builtin;
  const dirty = layout !== view.layout || groupBy !== view.groupBy;

  const refreshViews = () =>
    client.invalidateQueries({ queryKey: ["feed", "views"] });

  async function saveChanges() {
    try {
      await save.mutateAsync({
        id: view.id,
        groupId: view.groupId,
        name: view.name,
        shared: view.shared,
        layout,
        filter: view.filter,
        sort: view.sort ?? undefined,
        groupBy: groupBy ?? undefined,
        pinned: view.pinned,
      });
    } catch (e) {
      showAlert(`뷰를 저장하지 못했습니다: ${errorMessage(e)}`);
    }
  }

  async function copyAsMine() {
    const answer = await askSaveView({
      defaultName: `${view.name} 사본`,
      groupName: group?.name,
    });
    if (!answer) return;
    try {
      const copy = await save.mutateAsync({
        groupId: view.groupId,
        name: answer.name,
        shared: answer.shared,
        layout,
        filter: view.filter,
        sort: view.sort ?? undefined,
        groupBy: groupBy ?? undefined,
        pinned: false,
      });
      router.push(`${FEED.view}?id=${encodeURIComponent(copy.id)}`);
    } catch (e) {
      showAlert(`뷰를 복사하지 못했습니다: ${errorMessage(e)}`);
    }
  }

  async function togglePin() {
    setBusy(true);
    try {
      await viewsApi.pin(view.id, !view.pinned);
      await refreshViews();
    } catch (e) {
      showAlert(`고정을 바꾸지 못했습니다: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await showConfirm(`‘${view.name}’ 뷰를 지울까요?`, {
      confirmLabel: "지우기",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await viewsApi.remove(view.id);
      await refreshViews();
      router.push(FEED.home);
    } catch (e) {
      showAlert(`뷰를 지우지 못했습니다: ${errorMessage(e)}`);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{view.name}</h1>
        <ViewBadge view={view} />
        {group && <span className="text-xs text-fg-muted">{group.name}</span>}
        <span className="text-xs text-fg-muted tabular-nums">
          {query.data ? `${query.data.total}건` : ""}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className={seg.root({ class: "self-auto" })}>
            {LAYOUTS.map((l) => (
              <button
                key={l.value}
                type="button"
                className={seg.item()}
                aria-pressed={layout === l.value}
                onClick={() => setLayout(l.value)}
              >
                {l.label}
              </button>
            ))}
          </span>
          {canEdit ? (
            <button
              type="button"
              className={button({
                size: "sm",
                variant: dirty ? "primary" : "secondary",
              })}
              disabled={!dirty || save.isPending}
              onClick={saveChanges}
            >
              <Save size={14} aria-hidden="true" />
              저장
            </button>
          ) : (
            <button
              type="button"
              className={button({ size: "sm" })}
              disabled={save.isPending}
              onClick={copyAsMine}
            >
              <Copy size={14} aria-hidden="true" />내 뷰로 복사
            </button>
          )}
          <button
            type="button"
            className={button({ size: "sm" })}
            aria-pressed={view.pinned}
            disabled={busy}
            onClick={togglePin}
          >
            {view.pinned ? (
              <PinOff size={14} aria-hidden="true" />
            ) : (
              <Pin size={14} aria-hidden="true" />
            )}
            {view.pinned ? "고정 해제" : "고정"}
          </button>
          {canEdit && (
            <button
              type="button"
              className={button({ size: "sm", variant: "danger" })}
              disabled={busy}
              onClick={remove}
            >
              <Trash2 size={14} aria-hidden="true" />
              지우기
            </button>
          )}
        </div>
      </header>

      {layout === "list" && (
        <GroupByPick value={groupBy} onChange={setGroupBy} />
      )}

      {query.isPending ? (
        layout === "list" ? (
          <TableSkeleton />
        ) : layout === "board" ? (
          <BoardSkeleton />
        ) : (
          <CardGridSkeleton />
        )
      ) : query.isError ? (
        <EmptyState
          icon={<LayoutGrid size={20} />}
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
      ) : posts.length === 0 && layout !== "board" ? (
        <EmptyState
          icon={<LayoutGrid size={20} />}
          title="이 뷰에 맞는 게시물이 없습니다"
        />
      ) : layout === "feed" ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
          {posts.map((p) => (
            <li key={p.id} className="grid">
              <PostCard post={p} onOpen={openPeek} />
            </li>
          ))}
        </ul>
      ) : layout === "list" ? (
        <PostTable posts={posts} groupBy={groupBy} onOpen={openPeek} />
      ) : (
        <PostBoard
          posts={posts}
          groupId={view.groupId ?? undefined}
          onOpen={openPeek}
        />
      )}
    </div>
  );
}

export function SavedViewView() {
  const id = useSearchParams().get("id");
  const view = useView(id);

  if (!id)
    return (
      <EmptyState icon={<BookmarkX size={20} />} title="뷰를 고르세요">
        <p>사이드바의 저장된 뷰나 리스트의 ‘뷰로 저장’에서 엽니다.</p>
        <HomeLink />
      </EmptyState>
    );
  if (view.isPending)
    return (
      <div className="flex flex-col gap-3 p-6" aria-busy="true">
        <Skeleton width={30} className="h-5" />
        <CardGridSkeleton />
      </div>
    );
  if (view.isError) {
    const missing =
      view.error instanceof FeedApiError &&
      (view.error.status === 404 || view.error.status === 403);
    return missing ? (
      <EmptyState icon={<BookmarkX size={20} />} title="뷰를 찾을 수 없습니다">
        <p>지워졌거나, 볼 수 없는 그룹의 뷰입니다.</p>
        <HomeLink />
      </EmptyState>
    ) : (
      <EmptyState
        icon={<BookmarkX size={20} />}
        title="뷰를 불러오지 못했습니다"
      >
        <p>{view.error.message}</p>
        <button
          type="button"
          className={button({ size: "sm", class: "mt-2" })}
          onClick={() => view.refetch()}
        >
          <RefreshCw size={14} aria-hidden="true" />
          다시 시도
        </button>
      </EmptyState>
    );
  }
  // 다른 뷰로 옮기면 표시 방식 등 화면 상태를 새로 시작한다
  return <ViewBody key={view.data.id} view={view.data} />;
}

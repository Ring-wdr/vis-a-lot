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
import { PostCard } from "@/entities/post/ui/PostCard";
import { PostTable } from "@/entities/post/ui/PostTable";
import { TableSkeleton } from "@/entities/post/ui/TableSkeleton";
import { DEFAULT_SORT } from "@/features/filter-posts/model/filter-url";
import { GroupByPick } from "@/features/filter-posts/ui/list-controls";
import { askSaveView } from "@/features/save-view/ui/save-view-dialog";
import { FeedApiError } from "@/shared/api/feed/client";
import { useGroupMap } from "@/shared/api/feed/lookups";
import {
  usePostQuery,
  useSaveView,
  useView,
} from "@/shared/api/feed/post-queries";
import type {
  SavedView,
  ViewGroupBy,
  ViewLayout,
} from "@/shared/api/feed/types";
import { viewsApi } from "@/shared/api/feed/views";
import { FEED } from "@/shared/config/feed-routes";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { useOpenPeek } from "@/shared/lib/peek";
import { cn } from "@/shared/lib/tw";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { EmptyState, Skeleton } from "@/shared/ui/Loading";
import { segmented } from "@/shared/ui/segmented";
import { BoardSkeleton } from "@/widgets/post-board/ui/BoardSkeleton";
import { PostBoard } from "@/widgets/post-board/ui/PostBoard";

const seg = segmented();

const LAYOUTS: ViewLayout[] = ["feed", "list", "board"];

const messages = defineMessages({
  ko: {
    layouts: { feed: "피드", list: "리스트", board: "보드" } as Record<
      ViewLayout,
      string
    >,
    toHome: "홈으로",
    builtin: "기본 제공",
    shared: "그룹 공유",
    personal: "개인",
    saveFailed: (reason: string) => `뷰를 저장하지 못했습니다: ${reason}`,
    copyName: (name: string) => `${name} 사본`,
    copyFailed: (reason: string) => `뷰를 복사하지 못했습니다: ${reason}`,
    pinFailed: (reason: string) => `고정을 바꾸지 못했습니다: ${reason}`,
    removeConfirm: (name: string) => `‘${name}’ 뷰를 지울까요?`,
    remove: "지우기",
    removeFailed: (reason: string) => `뷰를 지우지 못했습니다: ${reason}`,
    total: (n: number) => `${n}건`,
    save: "저장",
    copyAsMine: "내 뷰로 복사",
    pin: "고정",
    unpin: "고정 해제",
    postsFailed: "게시물을 불러오지 못했습니다",
    retry: "다시 시도",
    empty: "이 뷰에 맞는 게시물이 없습니다",
    pickView: "뷰를 고르세요",
    pickViewHint: "사이드바의 저장된 뷰나 리스트의 ‘뷰로 저장’에서 엽니다.",
    notFound: "뷰를 찾을 수 없습니다",
    notFoundHint: "지워졌거나, 볼 수 없는 그룹의 뷰입니다.",
    viewFailed: "뷰를 불러오지 못했습니다",
  },
  en: {
    layouts: { feed: "Feed", list: "List", board: "Board" },
    toHome: "Go home",
    builtin: "Built-in",
    shared: "Shared",
    personal: "Personal",
    saveFailed: (reason: string) => `Couldn't save the view: ${reason}`,
    copyName: (name: string) => `${name} copy`,
    copyFailed: (reason: string) => `Couldn't copy the view: ${reason}`,
    pinFailed: (reason: string) => `Couldn't change the pin: ${reason}`,
    removeConfirm: (name: string) => `Delete the view ‘${name}’?`,
    remove: "Delete",
    removeFailed: (reason: string) => `Couldn't delete the view: ${reason}`,
    total: (n: number) => `${n} ${n === 1 ? "post" : "posts"}`,
    save: "Save",
    copyAsMine: "Copy to mine",
    pin: "Pin",
    unpin: "Unpin",
    postsFailed: "Couldn't load posts",
    retry: "Retry",
    empty: "No posts match this view",
    pickView: "Pick a view",
    pickViewHint:
      "Open one from Saved views in the sidebar or ‘Save view’ in a list.",
    notFound: "View not found",
    notFoundHint: "It was deleted, or belongs to a group you can't see.",
    viewFailed: "Couldn't load the view",
  },
});

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

function HomeLink() {
  const text = useT(messages);
  return (
    <Link
      href={FEED.home}
      className={button({ size: "sm", class: "mt-2 no-underline" })}
    >
      {text.toHome}
    </Link>
  );
}

function ViewBadge({ view }: { view: SavedView }) {
  const text = useT(messages);
  const label = view.builtin
    ? text.builtin
    : view.shared
      ? text.shared
      : text.personal;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm px-1.5 text-2xs font-semibold whitespace-nowrap",
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
  const text = useT(messages);
  const client = useQueryClient();
  const router = useRouter();
  const openPeek = useOpenPeek();
  const groups = useGroupMap();
  const save = useSaveView();
  const [layout, setLayout] = useState<ViewLayout>(view.layout);
  const [groupBy, setGroupBy] = useState<ViewGroupBy | null>(view.groupBy);
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
        sort: view.sort,
        groupBy,
        pinned: view.pinned,
      });
    } catch (e) {
      showAlert(text.saveFailed(errorMessage(e)));
    }
  }

  async function copyAsMine() {
    const answer = await askSaveView({
      defaultName: text.copyName(view.name),
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
        sort: view.sort,
        groupBy,
        pinned: false,
      });
      router.push(`${FEED.view}?id=${encodeURIComponent(copy.id)}`);
    } catch (e) {
      showAlert(text.copyFailed(errorMessage(e)));
    }
  }

  async function togglePin() {
    setBusy(true);
    try {
      await viewsApi.pin(view.id, !view.pinned);
      await refreshViews();
    } catch (e) {
      showAlert(text.pinFailed(errorMessage(e)));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await showConfirm(text.removeConfirm(view.name), {
      confirmLabel: text.remove,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await viewsApi.remove(view.id);
      await refreshViews();
      router.push(FEED.home);
    } catch (e) {
      showAlert(text.removeFailed(errorMessage(e)));
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
          {query.data ? text.total(query.data.total) : ""}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className={seg.root({ class: "self-auto" })}>
            {LAYOUTS.map((value) => (
              <button
                key={value}
                type="button"
                className={seg.item()}
                aria-pressed={layout === value}
                onClick={() => setLayout(value)}
              >
                {text.layouts[value]}
              </button>
            ))}
          </span>
          {canEdit ? (
            <button
              type="button"
              className={button({
                size: "sm",
                variant: dirty ? "primary" : "secondary",
                class: "whitespace-nowrap",
              })}
              disabled={!dirty || save.isPending}
              onClick={saveChanges}
            >
              <Save size={14} aria-hidden="true" />
              {text.save}
            </button>
          ) : (
            <button
              type="button"
              className={button({ size: "sm", class: "whitespace-nowrap" })}
              disabled={save.isPending}
              onClick={copyAsMine}
            >
              <Copy size={14} aria-hidden="true" />
              {text.copyAsMine}
            </button>
          )}
          <button
            type="button"
            className={button({ size: "sm", class: "whitespace-nowrap" })}
            aria-pressed={view.pinned}
            disabled={busy}
            onClick={togglePin}
          >
            {view.pinned ? (
              <PinOff size={14} aria-hidden="true" />
            ) : (
              <Pin size={14} aria-hidden="true" />
            )}
            {view.pinned ? text.unpin : text.pin}
          </button>
          {canEdit && (
            <button
              type="button"
              className={button({
                size: "sm",
                variant: "danger",
                class: "whitespace-nowrap",
              })}
              disabled={busy}
              onClick={remove}
            >
              <Trash2 size={14} aria-hidden="true" />
              {text.remove}
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
        <EmptyState icon={<LayoutGrid size={20} />} title={text.postsFailed}>
          <p>{query.error.message}</p>
          <button
            type="button"
            className={button({ size: "sm", class: "mt-2" })}
            onClick={() => query.refetch()}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {text.retry}
          </button>
        </EmptyState>
      ) : posts.length === 0 && layout !== "board" ? (
        <EmptyState icon={<LayoutGrid size={20} />} title={text.empty} />
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
  const text = useT(messages);

  if (!id)
    return (
      <EmptyState icon={<BookmarkX size={20} />} title={text.pickView}>
        <p>{text.pickViewHint}</p>
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
      <EmptyState icon={<BookmarkX size={20} />} title={text.notFound}>
        <p>{text.notFoundHint}</p>
        <HomeLink />
      </EmptyState>
    ) : (
      <EmptyState icon={<BookmarkX size={20} />} title={text.viewFailed}>
        <p>{view.error.message}</p>
        <button
          type="button"
          className={button({ size: "sm", class: "mt-2" })}
          onClick={() => view.refetch()}
        >
          <RefreshCw size={14} aria-hidden="true" />
          {text.retry}
        </button>
      </EmptyState>
    );
  }
  // 다른 뷰로 옮기면 표시 방식 등 화면 상태를 새로 시작한다
  return <ViewBody key={view.data.id} view={view.data} />;
}

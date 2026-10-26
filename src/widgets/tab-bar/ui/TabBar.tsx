"use client";

import { ChevronLeft, ChevronRight, Filter, Plus, X } from "lucide-react";
import { useStore } from "zustand";
import { chartTitle } from "@/entities/chart/lib/title";
import { useTabs, useTabsStore } from "@/entities/workspace/model/tabs-scope";
import {
  TABS_LOCKED_HINT,
  type View,
  type WorkspaceTab,
} from "@/entities/workspace/model/tabs-store";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useColumns, useDatasetNames } from "@/shared/api/queries";
import { tv } from "@/shared/lib/tw";
import { LoadingText } from "@/shared/ui/Loading";
import { useTabScroll } from "../model/use-tab-scroll";

// 탭 닫기·새 탭
const iconButton = tv({
  base: "inline-grid flex-none cursor-pointer place-items-center rounded-sm text-fg-muted enabled:hover:bg-panel-strong enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-45",
});

/** 탭 이름: 그린 차트가 있으면 차트 이름, 아직이면 고른 데이터. history 탭은 다시 그리기 전까지 불러오는 중이다. */
function TabLabel({ tab }: { tab: WorkspaceTab }) {
  const spec = useStore(tab.store, (s) => s.current?.spec);
  const dataset = useStore(tab.store, (s) => s.draft.dataset);
  const columns = useColumns(spec?.dataset ?? dataset);
  const nameOf = useDatasetNames();
  const loading = !spec && tab.view === "history";
  const label = spec
    ? chartTitle(spec, columns)
    : loading
      ? "불러오는 중"
      : `새 차트 · ${nameOf(dataset)}`;
  return (
    <span className="truncate" title={label}>
      {loading ? <LoadingText>{label}</LoadingText> : label}
    </span>
  );
}

/** 지금 view(gallery / history)의 탭들. gallery는 + 로 새 작업 공간을 연다. */
export function TabBar({ view }: { view: View }) {
  const tabs = useTabs((s) => s.tabs);
  const active = useTabs((s) => s.active[view]);
  const mine = tabs.filter((t) => t.view === view);
  const { activate, close, openGallery } = useTabsStore().getState();
  const closable = view === "history" || mine.length > 1;
  // 그리는 중에는 지금 탭에 머문다. 막힌 버튼에는 이유를 title로 보여준다.
  const locked = useTabs((s) => s.locked);
  const lockedHint = locked ? TABS_LOCKED_HINT : undefined;
  const scroll = useTabScroll(mine.length, active);
  const overflowing = scroll.canLeft || scroll.canRight;

  return (
    <div className="col-span-full flex min-w-0 items-end gap-1 border-b border-line bg-panel px-3">
      {overflowing && (
        <button
          type="button"
          className={iconButton({ class: "mb-0.5 size-6.5" })}
          aria-label="앞 탭 보기"
          title="앞 탭 보기"
          disabled={!scroll.canLeft}
          onClick={() => scroll.scrollBy(-1)}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
      )}
      {/* 탭이 넘치면 가로로 스크롤한다. 줄 높이를 지키려고 스크롤바는 숨기고 양옆 버튼·휠로 넘긴다.
          고른 탭이 아래 테두리를 덮도록 1px 내려 두고, 세로로 넘친 부분은 자른다. */}
      <div
        ref={scroll.ref}
        role="tablist"
        aria-label={`${view} 탭`}
        className="-mb-px flex min-w-0 [scrollbar-width:none] items-end gap-0.5 overflow-x-auto overflow-y-hidden"
        title={lockedHint}
      >
        {mine.map((tab) => (
          <div
            key={tab.id}
            // 이름(새 차트 → 차트 이름)이 바뀌어도 폭이 그대로이도록 폭을 정해 두고 말줄임한다.
            // 자리가 모자라면 7rem까지 줄고, 그보다 많으면 스크롤한다.
            data-tab
            className="group/tab flex h-7.5 w-50 min-w-28 items-center rounded-t-md border border-b-0 border-transparent text-fg-secondary not-data-active:hover:bg-panel-hover data-active:border-line data-active:bg-surface data-active:text-fg"
            data-active={tab.id === active || undefined}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab.id === active}
              className="flex h-full min-w-0 flex-1 cursor-pointer items-center pr-1 pl-3 text-xs group-data-active/tab:font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              disabled={locked && tab.id !== active}
              onClick={() => activate(tab.id)}
            >
              <TabLabel tab={tab} />
            </button>
            {closable && (
              <button
                type="button"
                className={iconButton({ class: "mr-1.5 size-5" })}
                aria-label="탭 닫기"
                title={lockedHint ?? "탭 닫기"}
                disabled={locked}
                onClick={() => close(tab.id)}
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {view === "history" && mine.length === 0 && (
          <span className="self-center px-1 pb-1.5 text-xs text-fg-muted">
            왼쪽 목록에서 고르면 탭으로 열립니다.
          </span>
        )}
      </div>
      {overflowing && (
        <button
          type="button"
          className={iconButton({ class: "mb-0.5 size-6.5" })}
          aria-label="뒤 탭 보기"
          title="뒤 탭 보기"
          disabled={!scroll.canRight}
          onClick={() => scroll.scrollBy(1)}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
      {view === "gallery" && (
        <button
          type="button"
          className={iconButton({ class: "mb-0.5 size-6.5" })}
          aria-label="새 탭"
          title={lockedHint ?? "새 탭"}
          disabled={locked}
          onClick={() => openGallery()}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      )}
      <FilterToggle />
    </div>
  );
}

/** 탭 바 오른쪽: 필터 패널 열기/닫기. 지금 탭에 걸린 필터 수를 보여준다. */
function FilterToggle() {
  const open = useTabs((s) => s.filterPanelOpen);
  const toggle = useTabs((s) => s.toggleFilterPanel);
  const count = useWorkspace((s) => s.draft.filters?.length ?? 0);
  return (
    <button
      type="button"
      className="mb-1 ml-auto inline-flex flex-none cursor-pointer items-center gap-1 rounded-md border border-line bg-elevated px-2.5 py-1 text-xs text-fg-secondary aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
      aria-pressed={open}
      onClick={toggle}
    >
      <Filter size={13} aria-hidden="true" />
      필터
      {count > 0 && (
        <span className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-3xs text-on-accent">
          {count}
        </span>
      )}
    </button>
  );
}

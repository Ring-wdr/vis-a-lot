"use client";

import { Filter, Plus, X } from "lucide-react";
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

// 탭 닫기·새 탭
const iconButton = tv({
  base: "inline-grid flex-none cursor-pointer place-items-center rounded-sm text-fg-muted enabled:hover:bg-panel-10 enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-45",
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

  return (
    <div className="col-span-full flex min-w-0 items-end gap-1 border-line border-b bg-panel px-3">
      <div
        role="tablist"
        aria-label={`${view} 탭`}
        className="flex min-w-0 items-end gap-0.5 overflow-x-auto [scrollbar-width:thin]"
        title={lockedHint}
      >
        {mine.map((tab) => (
          <div
            key={tab.id}
            // 이름(새 차트 → 차트 이름)이 바뀌어도 폭이 그대로이도록 폭을 정해 두고 말줄임한다.
            className="group/tab -mb-px flex h-7.5 w-50 flex-none items-center rounded-t-md border border-transparent border-b-0 text-fg-secondary not-data-active:hover:bg-panel-5 data-active:border-line data-active:bg-surface data-active:text-fg"
            data-active={tab.id === active || undefined}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab.id === active}
              className="flex h-full min-w-0 flex-1 cursor-pointer items-center pr-1 pl-3 text-12 disabled:cursor-not-allowed disabled:opacity-45 group-data-active/tab:font-semibold"
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
          <span className="self-center px-1 pb-1.5 text-12 text-fg-muted">
            왼쪽 목록에서 고르면 탭으로 열립니다.
          </span>
        )}
      </div>
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
      className="mb-1 ml-auto inline-flex flex-none cursor-pointer items-center gap-1.25 rounded-md border border-line bg-elevated px-2.5 py-0.75 text-12 text-fg-secondary aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
      aria-pressed={open}
      onClick={toggle}
    >
      <Filter size={13} aria-hidden="true" />
      필터
      {count > 0 && (
        <span className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-10 text-on-accent">
          {count}
        </span>
      )}
    </button>
  );
}

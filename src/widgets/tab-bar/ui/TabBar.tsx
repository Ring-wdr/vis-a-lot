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
import { LoadingText } from "@/shared/ui/Loading";
import styles from "./TabBar.module.css";

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
    <span className={styles.label} title={label}>
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
    <div className={styles.bar}>
      <div
        role="tablist"
        aria-label={`${view} 탭`}
        className={styles.tabs}
        title={lockedHint}
      >
        {mine.map((tab) => (
          <div
            key={tab.id}
            className={styles.tab}
            data-active={tab.id === active || undefined}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab.id === active}
              className={styles.select}
              disabled={locked && tab.id !== active}
              onClick={() => activate(tab.id)}
            >
              <TabLabel tab={tab} />
            </button>
            {closable && (
              <button
                type="button"
                className={styles.close}
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
          <span className={styles.hint}>
            왼쪽 목록에서 고르면 탭으로 열립니다.
          </span>
        )}
      </div>
      {view === "gallery" && (
        <button
          type="button"
          className={styles.add}
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
      className={styles.filterToggle}
      aria-pressed={open}
      onClick={toggle}
    >
      <Filter size={13} aria-hidden="true" />
      필터
      {count > 0 && <span className={styles.badge}>{count}</span>}
    </button>
  );
}

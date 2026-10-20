"use client";

import { Filter, Plus, X } from "lucide-react";
import { useStore } from "zustand";
import { chartTitle } from "@/entities/chart/lib/title";
import { ROW_LABELS } from "@/entities/dataset/lib/labels";
import {
  tabsStore,
  useTabs,
  type View,
  type WorkspaceTab,
} from "@/entities/workspace/model/tabs-store";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import styles from "./TabBar.module.css";

/** 탭 이름: 그린 차트가 있으면 차트 이름, 아직이면 고른 데이터 */
function TabLabel({ tab }: { tab: WorkspaceTab }) {
  const label = useStore(tab.store, (s) =>
    s.current
      ? chartTitle(s.current.spec)
      : `새 차트 · IoT ${ROW_LABELS[s.draft.rows]}`,
  );
  return (
    <span className={styles.label} title={label}>
      {label}
    </span>
  );
}

/** 지금 view(gallery / history)의 탭들. gallery는 + 로 새 작업 공간을 연다. */
export function TabBar({ view }: { view: View }) {
  const tabs = useTabs((s) => s.tabs);
  const active = useTabs((s) => s.active[view]);
  const mine = tabs.filter((t) => t.view === view);
  const { activate, close, openGallery } = tabsStore.getState();
  const closable = view === "history" || mine.length > 1;

  return (
    <div className={styles.bar}>
      <div role="tablist" aria-label={`${view} 탭`} className={styles.tabs}>
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
              onClick={() => activate(tab.id)}
            >
              <TabLabel tab={tab} />
            </button>
            {closable && (
              <button
                type="button"
                className={styles.close}
                aria-label="탭 닫기"
                title="탭 닫기"
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
          title="새 탭"
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
  const count = useWorkspace((s) => s.draft.filters?.length ?? 0);
  return (
    <button
      type="button"
      className={styles.filterToggle}
      aria-pressed={open}
      onClick={() => tabsStore.getState().toggleFilterPanel()}
    >
      <Filter size={13} aria-hidden="true" />
      필터
      {count > 0 && <span className={styles.badge}>{count}</span>}
    </button>
  );
}

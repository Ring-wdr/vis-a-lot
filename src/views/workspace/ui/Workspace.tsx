"use client";

import { useEffect } from "react";
import { readShareHash } from "@/entities/chart/lib/share";
import {
  emptyHistoryStore,
  useTabs,
} from "@/entities/workspace/model/tabs-store";
import {
  useWorkspace,
  WorkspaceScope,
} from "@/entities/workspace/model/workspace-scope";
import { SettingsButton } from "@/features/chart-settings/ui/SettingsButton";
import { DrawButton } from "@/features/draw-chart/ui/DrawButton";
import { useOpenChart } from "@/features/open-chart/model/open-chart";
import { EditInGalleryButton } from "@/features/open-chart/ui/EditInGalleryButton";
import styles from "@/shared/ui/workspace.module.css";
import { AppHeader } from "@/widgets/app-header/ui/AppHeader";
import { ChartGrid } from "@/widgets/chart-grid/ui/ChartGrid";
import { ControlPanel } from "@/widgets/control-panel/ui/ControlPanel";
import { FilterPanel } from "@/widgets/filter-panel/ui/FilterPanel";
import { HistoryList } from "@/widgets/history-list/ui/HistoryList";
import { TabBar } from "@/widgets/tab-bar/ui/TabBar";

// tab을 오가며 gallery가 다시 마운트돼도 공유 링크는 처음 한 번만 연다.
let sharedLinkHandled = false;

/** 공유 링크(#s=…)로 들어오면 grid 크기를 안 뒤에 한 번 그 차트를 gallery에 그린다. */
function useOpenSharedLink() {
  const gridArea = useWorkspace((s) => s.gridArea);
  const open = useOpenChart();

  useEffect(() => {
    if (sharedLinkHandled || !gridArea) return;
    sharedLinkHandled = true;
    const shared = readShareHash(location.hash);
    if (!shared) return;
    // 새로고침할 때마다 다시 그려 history가 쌓이지 않도록 hash는 지운다.
    history.replaceState(null, "", location.pathname + location.search);
    open.mutate(shared);
  }, [gridArea, open]);
}

function GallerySidebar() {
  useOpenSharedLink();
  return (
    <>
      <div className={styles.panelBody}>
        <ControlPanel />
      </div>
      <div className={styles.panelFooter}>
        <SettingsButton />
        <DrawButton />
      </div>
    </>
  );
}

function HistorySidebar() {
  const viewing = useWorkspace((s) => s.current !== undefined);
  return (
    <>
      <div className={styles.panelBody}>
        <section className={styles.panelSection}>
          <h2 className={styles.sectionTitle}>History</h2>
          <HistoryList />
        </section>
        {viewing && (
          <section className={styles.panelSection}>
            <h2 className={styles.sectionTitle}>설정 (보기 전용)</h2>
            <ControlPanel />
          </section>
        )}
      </div>
      <div className={styles.panelFooter}>
        <EditInGalleryButton />
      </div>
    </>
  );
}

/**
 * 작업 화면. gallery는 그리고 편집하는 곳, history는 그린 차트를 다시 보기만 하는 곳이다.
 * view마다 탭이 있고, 탭마다 작업 상태(store)를 따로 들고 있어 오가도 각자 보던 차트가 남는다.
 */
export function Workspace() {
  const view = useTabs((s) => s.view);
  const tab = useTabs((s) => s.tabs.find((t) => t.id === s.active[s.view]));
  // history 탭이 하나도 없으면 빈 보기 전용 상태로 목록만 보여준다.
  const store = tab?.store ?? emptyHistoryStore;
  const filterOpen = useTabs((s) => s.filterPanelOpen);

  return (
    <WorkspaceScope key={tab?.id ?? "empty"} store={store}>
      <div className={styles.workspace}>
        <AppHeader />
        <TabBar view={view} />
        <aside className={styles.panel}>
          {view === "gallery" ? <GallerySidebar /> : <HistorySidebar />}
        </aside>
        <main className={styles.main}>
          <ChartGrid />
        </main>
        {filterOpen && (
          <div className={styles.filterDrawer}>
            <FilterPanel />
          </div>
        )}
      </div>
    </WorkspaceScope>
  );
}

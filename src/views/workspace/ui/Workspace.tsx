"use client";

import { Trans } from "@lingui/react/macro";
import { Fragment, useEffect } from "react";
import { readShareHash } from "@/entities/chart/lib/share";
import { useTabs, useTabsStore } from "@/entities/workspace/model/tabs-scope";
import type { View } from "@/entities/workspace/model/tabs-store";
import {
  useWorkspace,
  useWorkspaceStore,
  WorkspaceScope,
} from "@/entities/workspace/model/workspace-scope";
import { SettingsButton } from "@/features/chart-settings/ui/SettingsButton";
import { useDrawState } from "@/features/draw-chart/model/draw-state";
import { DrawButton } from "@/features/draw-chart/ui/DrawButton";
import { useOpenChart } from "@/features/open-chart/model/open-chart";
import { takeQueuedOpen } from "@/features/open-chart/model/pending-open";
import { EditInGalleryButton } from "@/features/open-chart/ui/EditInGalleryButton";

import { cn } from "@/shared/lib/tw";
import { showAlert } from "@/shared/ui/AlertDialog";
import { AppHeader } from "@/widgets/app-header/ui/AppHeader";
import { ChartGrid } from "@/widgets/chart-grid/ui/ChartGrid";
import { ControlPanel } from "@/widgets/control-panel/ui/ControlPanel";
import { FilterPanel } from "@/widgets/filter-panel/ui/FilterPanel";
import { HistoryList } from "@/widgets/history-list/ui/HistoryList";
import { HomeLanding } from "@/widgets/home-landing/ui/HomeLanding";
import { TabBar } from "@/widgets/tab-bar/ui/TabBar";
import { TabToolbar } from "@/widgets/tab-toolbar/ui/TabToolbar";
import "../config/messages";

// tab을 오가며 gallery가 다시 마운트돼도 공유 링크는 처음 한 번만 연다.
let sharedLinkHandled = false;

/**
 * grid 크기를 안 뒤에 열 차트를 연다: 공유 페이지가 이 탭에 맡겨 둔 차트,
 * 또는 hash 공유 링크(#s=…)로 들어왔을 때 그 차트(처음 한 번).
 */
function useOpenSharedLink() {
  const gridArea = useWorkspace((s) => s.gridArea);
  const store = useWorkspaceStore();
  const open = useOpenChart();

  useEffect(() => {
    if (!gridArea) return;
    const queued = takeQueuedOpen(store);
    if (queued) {
      open.mutate(queued);
      return;
    }
    if (sharedLinkHandled) return;
    sharedLinkHandled = true;
    const shared = readShareHash(location.hash);
    if (!shared) return;
    // 새로고침할 때마다 다시 그려 history가 쌓이지 않도록 hash는 지운다.
    history.replaceState(null, "", location.pathname + location.search);
    open.mutate(shared);
  }, [gridArea, store, open]);
}

/** 보고 있는 탭의 오류를 띄운다. 다른 탭에서 난 오류는 그 탭으로 돌아왔을 때 뜬다. */
function TabNotices() {
  const store = useWorkspaceStore();

  useEffect(() => {
    // 꺼내면서 비우므로 StrictMode에서 effect가 두 번 돌아도 한 번만 뜬다.
    const flush = () => {
      const { notices } = store.getState();
      if (notices.length === 0) return;
      store.setState({ notices: [] });
      for (const message of notices) showAlert(message);
    };
    flush();
    return store.subscribe(flush);
  }, [store]);
  return null;
}

/** 보고 있는 gallery 탭이 그리는 중이면 cancel하거나 끝날 때까지 탭 전환을 잠근다. */
function DrawLock() {
  const readOnly = useWorkspace((s) => s.readOnly);
  const drawing = useDrawState() !== "draw";
  const tabs = useTabsStore();
  const locked = !readOnly && drawing;

  // 그리는 상태는 이 탭의 query·mutation에서 나오므로, 탭 밖(헤더·탭 줄)이 읽는 탭 store에 옮겨 둔다.
  useEffect(() => tabs.getState().setLocked(locked), [locked, tabs]);
  return null;
}

const panelBody = "min-h-0 flex-1 overflow-y-auto p-4";
// 공통 속성·draw 같은 동작 버튼은 하단에 고정된다.
const panelFooter =
  "flex flex-col gap-2 border-line border-t bg-panel px-4 py-3";
const panelSection = "flex flex-col gap-2";
const sectionTitle = "font-semibold text-xs text-fg-secondary";

function GallerySidebar() {
  useOpenSharedLink();
  return (
    <>
      <div className={panelBody}>
        <ControlPanel />
      </div>
      <div className={panelFooter}>
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
      <div className={panelBody}>
        <section className={panelSection}>
          <h2 className={sectionTitle}>History</h2>
          <HistoryList />
        </section>
        {viewing && (
          <section
            className={cn(panelSection, "mt-5 border-t border-line pt-4")}
          >
            <h2 className={sectionTitle}>
              <Trans>설정 (보기 전용)</Trans>
            </h2>
            <ControlPanel />
          </section>
        )}
      </div>
      <div className={panelFooter}>
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
  const tab = useTabs((s) =>
    s.view ? s.tabs.find((t) => t.id === s.active[s.view as View]) : undefined,
  );
  // history 탭이 하나도 없으면 빈 보기 전용 상태로 목록만 보여준다.
  const emptyHistory = useTabs((s) => s.emptyHistory);
  const store = tab?.store ?? emptyHistory;
  const filterOpen = useTabs((s) => s.filterPanelOpen);

  // 처음 들어오면 연 차트가 없으므로 작업 화면 대신 시작 화면을 보여준다.
  if (view === null) {
    return (
      <div className="grid h-screen grid-rows-[3rem_minmax(0,1fr)] bg-surface text-fg">
        <AppHeader />
        <HomeLanding />
      </div>
    );
  }

  return (
    <WorkspaceScope store={store}>
      {/* 상단 바 · 탭 바 · 탭 도구 줄 · 탭 내용 */}
      <div className="grid h-screen grid-cols-[16.25rem_minmax(0,1fr)] grid-rows-[3rem_2.25rem_2.75rem_minmax(0,1fr)] bg-surface text-fg">
        <AppHeader />
        {/* 탭을 바꿔도 탭 바는 그대로 두어 가로 스크롤 위치를 지킨다. gallery·history는 탭 목록이 달라 따로 둔다. */}
        <TabBar key={view} view={view} />
        {/* 탭 내용은 탭마다 처음부터 마운트한다 (mutation·입력 상태가 다른 탭으로 새지 않게). */}
        <Fragment key={tab?.id ?? "empty"}>
          <TabNotices />
          <DrawLock />
          <TabToolbar />
          {/* 왼쪽 패널: 설정은 스크롤되고 동작 버튼은 하단에 고정된다. */}
          <aside className="col-1 row-4 flex min-h-0 flex-col border-r border-line bg-panel">
            {view === "gallery" ? <GallerySidebar /> : <HistorySidebar />}
          </aside>
          {/* 필터 drawer가 같은 칸에 겹치므로 자동 배치에 맡기지 않는다. */}
          <main className="col-2 row-4 min-h-0 min-w-0 p-4">
            <ChartGrid />
          </main>
          {filterOpen && (
            // 필터 패널은 차트 영역 위에 겹쳐 연다. 옆으로 밀면 차트 영역이 좁아져 레이아웃이 밀리고
            // 모든 item을 새 크기로 다시 그리게 된다.
            <div className="z-drawer col-[-2/-1] row-4 flex min-h-0 w-[min(18.75rem,100%)] justify-self-end shadow-drawer">
              <FilterPanel />
            </div>
          )}
        </Fragment>
      </div>
    </WorkspaceScope>
  );
}

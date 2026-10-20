"use client";

import { useEffect, useRef } from "react";
import { readShareHash } from "@/entities/chart/lib/share";
import { useWorkspace } from "@/entities/workspace/model/workspace-store";
import { useOpenChart } from "@/features/open-chart/model/open-chart";
import { ModeBar } from "@/features/select-mode/ui/ModeBar";
import { ShareButton } from "@/features/share-chart/ui/ShareButton";
import styles from "@/shared/ui/workspace.module.css";
import { ChartGrid } from "@/widgets/chart-grid/ui/ChartGrid";
import { ControlPanel } from "@/widgets/control-panel/ui/ControlPanel";
import { HistoryPanel } from "@/widgets/history-list/ui/HistoryPanel";

/** 공유 링크(#s=…)로 들어오면 grid 크기를 안 뒤에 한 번 그 차트를 그린다. */
function useOpenSharedLink() {
  const gridArea = useWorkspace((s) => s.gridArea);
  const open = useOpenChart();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current || !gridArea) return;
    opened.current = true;
    const shared = readShareHash(location.hash);
    if (!shared) return;
    // 새로고침할 때마다 다시 그려 history가 쌓이지 않도록 hash는 지운다.
    history.replaceState(null, "", location.pathname + location.search);
    open.mutate(shared);
  }, [gridArea, open]);
}

export function Workspace() {
  useOpenSharedLink();

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <span className={styles.brand}>vis-a-lot</span>
        <ModeBar />
        <div className={styles.headerActions}>
          <ShareButton />
          <HistoryPanel />
        </div>
      </header>
      <aside className={styles.panel}>
        <ControlPanel />
      </aside>
      <main className={styles.main}>
        <ChartGrid />
      </main>
    </div>
  );
}

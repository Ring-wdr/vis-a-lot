"use client";

import { useEffect, useRef } from "react";
import { useOpenChart } from "@/lib/open-chart";
import { readShareHash } from "@/lib/share";
import { useWorkspace } from "@/lib/workspace-store";
import { ChartGrid } from "./ChartGrid";
import { ControlPanel } from "./ControlPanel";
import { HistoryPanel } from "./HistoryPanel";
import { ModeBar } from "./ModeBar";
import { ShareButton } from "./ShareButton";
import styles from "./Workspace.module.css";

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

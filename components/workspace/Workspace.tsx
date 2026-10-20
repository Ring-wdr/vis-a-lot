"use client";

import { ChartGrid } from "./ChartGrid";
import { ControlPanel } from "./ControlPanel";
import { ModeBar } from "./ModeBar";
import styles from "./Workspace.module.css";

export function Workspace() {
  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <span className={styles.brand}>vis-a-lot</span>
        <ModeBar />
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

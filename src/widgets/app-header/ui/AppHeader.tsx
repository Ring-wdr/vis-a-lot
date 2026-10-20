"use client";

import { Database, History, LayoutGrid } from "lucide-react";
import {
  tabsStore,
  useTabs,
  VIEWS,
} from "@/entities/workspace/model/tabs-store";
import { UserMenu } from "@/features/auth/ui/UserMenu";
import { openDataDialog } from "@/features/register-dataset/ui/DataDialog";
import { ModeBar } from "@/features/select-mode/ui/ModeBar";
import { ShareButton } from "@/features/share-chart/ui/ShareButton";
import styles from "@/shared/ui/workspace.module.css";
import headerStyles from "./AppHeader.module.css";

const TAB_UI = {
  gallery: { label: "gallery", Icon: LayoutGrid },
  history: { label: "history", Icon: History },
} as const;

/** 상단 바: data 팝업, gallery(그리기·편집) / history(다시 보기) 전환, 모드, 공유. 각 view의 탭은 TabBar가 그린다. */
export function AppHeader() {
  const view = useTabs((s) => s.view);
  return (
    <header className={styles.header}>
      <span className={styles.brand}>vis-a-lot</span>
      <nav className={headerStyles.nav} aria-label="화면">
        <button
          type="button"
          className={headerStyles.navButton}
          aria-haspopup="dialog"
          onClick={openDataDialog}
        >
          <Database size={14} aria-hidden="true" />
          data
        </button>
        <div role="tablist" className={headerStyles.tabs}>
          {VIEWS.map((t) => {
            const { label, Icon } = TAB_UI[t];
            return (
              <button
                key={t}
                type="button"
                role="tab"
                className={headerStyles.navButton}
                aria-selected={view === t}
                onClick={() => tabsStore.getState().setView(t)}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
      <ModeBar />
      <div className={styles.headerActions}>
        <ShareButton />
        <UserMenu />
      </div>
    </header>
  );
}

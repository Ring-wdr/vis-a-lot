"use client";

import { Database, History, LayoutGrid } from "lucide-react";
import { useTabs, useTabsStore } from "@/entities/workspace/model/tabs-scope";
import { TABS_LOCKED_HINT, VIEWS } from "@/entities/workspace/model/tabs-store";
import { UserMenu } from "@/features/auth/ui/UserMenu";
import { openDataDialog } from "@/features/register-dataset/ui/DataDialog";
import styles from "@/shared/ui/workspace.module.css";
import headerStyles from "./AppHeader.module.css";

const TAB_UI = {
  gallery: { label: "gallery", Icon: LayoutGrid },
  history: { label: "history", Icon: History },
} as const;

/**
 * 상단 바: data 팝업, gallery(그리기·편집) / history(다시 보기) 전환, 사용자.
 * 각 view의 탭은 TabBar가, 탭 안의 모드·공유는 TabToolbar가 그린다.
 */
export function AppHeader() {
  const view = useTabs((s) => s.view);
  const tabs = useTabsStore();
  const locked = useTabs((s) => s.locked);
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
        <div
          role="tablist"
          className={headerStyles.tabs}
          title={locked ? TABS_LOCKED_HINT : undefined}
        >
          {VIEWS.map((t) => {
            const { label, Icon } = TAB_UI[t];
            return (
              <button
                key={t}
                type="button"
                role="tab"
                className={headerStyles.navButton}
                aria-selected={view === t}
                disabled={locked && view !== t}
                onClick={() => tabs.getState().setView(t)}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className={styles.headerActions}>
        <UserMenu />
      </div>
    </header>
  );
}

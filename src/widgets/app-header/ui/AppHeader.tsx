"use client";

import { Database, History, LayoutGrid, Upload } from "lucide-react";
import { useTabs, useTabsStore } from "@/entities/workspace/model/tabs-scope";
import { TABS_LOCKED_HINT, VIEWS } from "@/entities/workspace/model/tabs-store";
import { UserMenu } from "@/features/auth/ui/UserMenu";
import {
  openDatastoreDialog,
  openUploadThenDatastore,
} from "@/features/register-dataset/ui/DatastoreDialog";
import { tv } from "@/shared/lib/tw";

// 고른 화면 버튼도 hover 중에는 hover 바탕을 보인다.
const navButton = tv({
  base: "inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2.5 text-ui text-fg-secondary enabled:hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45 aria-selected:border-line aria-selected:font-semibold aria-selected:text-fg aria-selected:not-hover:bg-elevated",
});

const TAB_UI = {
  gallery: { label: "gallery", Icon: LayoutGrid },
  history: { label: "history", Icon: History },
} as const;

/**
 * 상단 바: upload·datastore 팝업, gallery(그리기·편집) / history(다시 보기) 전환, 사용자.
 * 각 view의 탭은 TabBar가, 탭 안의 모드·공유는 TabToolbar가 그린다.
 */
export function AppHeader() {
  const view = useTabs((s) => s.view);
  const tabs = useTabsStore();
  const locked = useTabs((s) => s.locked);
  return (
    <header className="col-span-full flex items-center gap-6 border-b border-line px-4">
      <span className="w-57 font-bold">vis-a-lot</span>
      <nav className="flex items-center gap-1" aria-label="화면">
        <button
          type="button"
          className={navButton()}
          aria-haspopup="dialog"
          onClick={openUploadThenDatastore}
        >
          <Upload size={14} aria-hidden="true" />
          upload
        </button>
        <button
          type="button"
          className={navButton()}
          aria-haspopup="dialog"
          onClick={() => openDatastoreDialog()}
        >
          <Database size={14} aria-hidden="true" />
          datastore
        </button>
        <div
          role="tablist"
          className="flex gap-1"
          title={locked ? TABS_LOCKED_HINT : undefined}
        >
          {VIEWS.map((t) => {
            const { label, Icon } = TAB_UI[t];
            return (
              <button
                key={t}
                type="button"
                role="tab"
                className={navButton()}
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
      <div className="ml-auto flex items-center gap-2">
        <UserMenu />
      </div>
    </header>
  );
}

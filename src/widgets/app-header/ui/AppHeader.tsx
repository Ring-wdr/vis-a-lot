"use client";

import { Database, History, LayoutGrid, Share2, Upload } from "lucide-react";
import Link from "next/link";
import { SHARE_PAGE } from "@/entities/chart/lib/share";
import { useTabs, useTabsStore } from "@/entities/workspace/model/tabs-scope";
import { TABS_LOCKED_HINT, VIEWS } from "@/entities/workspace/model/tabs-store";
import { UserMenu } from "@/features/auth/ui/UserMenu";
import {
  openDatastoreDialog,
  openUploadThenDatastore,
} from "@/features/register-dataset/ui/DatastoreDialog";
import { navButton, navLink } from "@/shared/ui/nav";

const TAB_UI = {
  gallery: { label: "gallery", Icon: LayoutGrid },
  history: { label: "history", Icon: History },
} as const;

/**
 * 상단 바: upload·datastore 팝업, gallery(그리기·편집) / history(다시 보기) 전환, 내 공유 페이지, 사용자.
 * 각 view의 탭은 TabBar가, 탭 안의 모드·공유는 TabToolbar가 그린다.
 */
export function AppHeader() {
  const view = useTabs((s) => s.view);
  const tabs = useTabsStore();
  const locked = useTabs((s) => s.locked);
  return (
    <header className="col-span-full flex items-center gap-6 border-b border-line px-4">
      <span className="w-57 text-base font-bold">vis-a-lot</span>
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
        <Link href={SHARE_PAGE} className={navLink()}>
          <Share2 size={14} aria-hidden="true" />
          shares
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <UserMenu />
      </div>
    </header>
  );
}

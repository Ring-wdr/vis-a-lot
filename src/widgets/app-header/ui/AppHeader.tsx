"use client";

import { useLingui } from "@lingui/react/macro";
import {
  CircleHelp,
  Database,
  History,
  LayoutGrid,
  Newspaper,
  Share2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { SHARE_PAGE } from "@/entities/chart/lib/share";
import { useTabs, useTabsStore } from "@/entities/workspace/model/tabs-scope";
import { tabsLockedHint, VIEWS } from "@/entities/workspace/model/tabs-store";
import { UserMenu } from "@/features/auth/ui/UserMenu";
import {
  openDatastoreDialog,
  openUploadThenDatastore,
} from "@/features/register-dataset/ui/DatastoreDialog";
import { LocaleSelect } from "@/features/switch-locale/ui/LocaleSelect";
import { ThemeSelect } from "@/features/switch-theme/ui/ThemeSelect";
import { helpServicePath } from "@/shared/config/help";
import { navButton, navLink } from "@/shared/ui/nav";
import "../config/messages";

const TAB_UI = {
  gallery: { label: "gallery", Icon: LayoutGrid },
  history: { label: "history", Icon: History },
} as const;

/**
 * 좁은 창에서는 화면 버튼·링크의 글자를 숨기고 아이콘만 남긴다. 글자는 읽어 주도록 sr-only로 둔다.
 * 로고와 사용자 메뉴가 줄어들지 않도록, 버튼이 다 들어가지 않는 폭부터 숨긴다.
 */
function NavLabel({ children }: { children: string }) {
  return <span className="max-[72rem]:sr-only">{children}</span>;
}

/**
 * 상단 바: upload·datastore 팝업, gallery(그리기·편집) / history(다시 보기) 전환, 내 공유 페이지, 피드, 도움말, 테마, 사용자.
 * 각 view의 탭은 TabBar가, 탭 안의 모드·공유는 TabToolbar가 그린다.
 */
export function AppHeader() {
  const view = useTabs((s) => s.view);
  const tabs = useTabsStore();
  const locked = useTabs((s) => s.locked);
  // tabsLockedHint는 지금 언어로 읽으므로 useLingui로 언어 변경을 구독한다.
  const { t } = useLingui();
  const lockedHint = locked ? tabsLockedHint() : undefined;
  return (
    <header className="col-span-full flex items-center gap-6 border-b border-line px-4">
      <span className="w-57 flex-none text-base font-bold whitespace-nowrap">
        vis-a-lot
      </span>
      <nav
        className="flex min-w-0 items-center gap-1"
        aria-label={t({ message: "화면", context: "app header nav" })}
      >
        <button
          type="button"
          className={navButton()}
          aria-haspopup="dialog"
          title="upload"
          onClick={openUploadThenDatastore}
        >
          <Upload size={14} aria-hidden="true" />
          <NavLabel>upload</NavLabel>
        </button>
        <button
          type="button"
          className={navButton()}
          aria-haspopup="dialog"
          title="datastore"
          onClick={() => openDatastoreDialog()}
        >
          <Database size={14} aria-hidden="true" />
          <NavLabel>datastore</NavLabel>
        </button>
        <div role="tablist" className="flex gap-1" title={lockedHint}>
          {VIEWS.map((v) => {
            const { label, Icon } = TAB_UI[v];
            return (
              <button
                key={v}
                type="button"
                role="tab"
                className={navButton()}
                aria-selected={view === v}
                title={lockedHint ?? label}
                disabled={locked && view !== v}
                onClick={() => tabs.getState().setView(v)}
              >
                <Icon size={14} aria-hidden="true" />
                <NavLabel>{label}</NavLabel>
              </button>
            );
          })}
        </div>
        <Link href={SHARE_PAGE} className={navLink()} title="shares">
          <Share2 size={14} aria-hidden="true" />
          <NavLabel>shares</NavLabel>
        </Link>
        <Link href="/feed" className={navLink()} title="feed">
          <Newspaper size={14} aria-hidden="true" />
          <NavLabel>feed</NavLabel>
        </Link>
        <Link href={helpServicePath("vis")} className={navLink()} title="help">
          <CircleHelp size={14} aria-hidden="true" />
          <NavLabel>help</NavLabel>
        </Link>
      </nav>
      <div className="ml-auto flex flex-none items-center gap-2">
        <UserMenu>
          <ThemeSelect />
          <LocaleSelect />
        </UserMenu>
      </div>
    </header>
  );
}

"use client";

import { CircleHelp, LayoutGrid, Menu, Newspaper, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { HELP_ROOT } from "@/shared/config/help";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { navLink } from "@/shared/ui/nav";
import { StableText } from "@/shared/ui/StableText";
import { HelpSidebar } from "@/widgets/help-sidebar/ui/HelpSidebar";
import { PreferencesMenu } from "./PreferencesMenu";

const messages = defineMessages({
  ko: {
    openToc: "목차 열기",
    closeToc: "목차 닫기",
    services: "서비스",
    vis: "시각화",
    feed: "피드",
  },
  en: {
    openToc: "Open contents",
    closeToc: "Close contents",
    services: "Services",
    vis: "Charts",
    feed: "Feed",
  },
});

/**
 * 도움말 화면 틀: 상단 바 + 왼쪽 목차 + 본문. 로그인 없이 열리는 정적 페이지라 mock 서버를 띄우지 않는다.
 * 화면 높이에 맞춰 상단 바는 늘 보이고, 목차와 본문이 따로 스크롤한다
 * (html·body의 overflow-x 때문에 문서 스크롤에서는 sticky가 붙지 않는다).
 * 48rem보다 좁으면 목차는 메뉴 버튼으로 여닫는 서랍이 된다.
 * 정적 HTML이라 보이는 글자는 StableText로(깜빡임·폭 변화 없음), 속성(aria-label)은 useT로 바꾼다.
 */
export function HelpShell({ children }: { children: ReactNode }) {
  const text = useT(messages);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-dvh flex-col bg-surface text-fg">
      <header className="flex h-12 flex-none items-center gap-2 border-b border-line px-4">
        <button
          type="button"
          className="-ml-1.5 inline-grid size-8 cursor-pointer place-items-center rounded-md text-fg-secondary hover:bg-panel md:hidden"
          aria-label={open ? text.closeToc : text.openToc}
          aria-expanded={open}
          aria-controls="help-sidebar"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
        <Link
          href={HELP_ROOT}
          className="flex items-center gap-1.5 text-base font-bold text-fg"
        >
          <CircleHelp size={16} aria-hidden="true" />
          <StableText ko="vis-a-lot 도움말" en="vis-a-lot Help" />
        </Link>
        <nav
          className="ml-auto flex items-center gap-1"
          aria-label={text.services}
        >
          <Link href="/" className={navLink()} aria-label={text.vis}>
            <LayoutGrid size={14} aria-hidden="true" />
            <span className="whitespace-nowrap max-sm:hidden">
              <StableText ko="시각화" en="Charts" />
            </span>
          </Link>
          <Link href="/feed" className={navLink()} aria-label={text.feed}>
            <Newspaper size={14} aria-hidden="true" />
            <span className="whitespace-nowrap max-sm:hidden">
              <StableText ko="피드" en="Feed" />
            </span>
          </Link>
          <PreferencesMenu />
        </nav>
      </header>
      <div className="relative flex min-h-0 flex-1">
        {open && (
          <button
            type="button"
            className="z-drawer absolute inset-0 cursor-default bg-backdrop md:hidden"
            aria-label={text.closeToc}
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          id="help-sidebar"
          data-open={open || undefined}
          className="z-drawer invisible absolute inset-y-0 left-0 w-64 -translate-x-full overflow-y-auto border-r border-line bg-surface px-3 py-5 shadow-drawer transition-transform data-open:visible data-open:translate-x-0 md:visible md:static md:w-60 md:flex-none md:translate-x-0 md:shadow-none"
          // 서랍에서 문서를 고르거나 Esc를 누르면 닫는다.
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <HelpSidebar />
        </aside>
        {/* 본문이 따로 스크롤하므로 문서를 옮기면 새 스크롤 영역으로 바꿔 맨 위에서 시작한다. */}
        <div key={pathname} className="min-w-0 flex-1 overflow-y-auto">
          <main className="mx-auto max-w-3xl px-4 pt-6 pb-16 md:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

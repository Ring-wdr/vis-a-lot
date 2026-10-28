"use client";

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Menu as MenuIcon, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { UserSwitcher } from "@/features/switch-user/ui/UserSwitcher";
import { FEED } from "@/shared/config/feed-routes";
import { inAllLocales } from "@/shared/lib/lingui";
import { AiBadge } from "@/shared/ui/AiBadge";
import { button } from "@/shared/ui/button";
import { navButton } from "@/shared/ui/nav";
import { StableText } from "@/shared/ui/StableText";
import { CommandPalette } from "@/widgets/command-palette/ui/CommandPalette";
import "./messages";
import { PreferencesMenu } from "./PreferencesMenu";

const NEW_POST = msg`새 게시물`;

/** Cmd/Ctrl+K: 커맨드 팔레트를 열고 닫는다 */
function usePaletteShortcut(toggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
}

/** 상단 바: 메뉴(좁은 화면), 검색·명령, 새 게시물, AI 배지, 테마, 사용자 전환 */
export function FeedTopBar({
  showMenu,
  menuOpen,
  onToggleMenu,
}: {
  showMenu: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const { t, i18n } = useLingui();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = () => setPaletteOpen(true);
  usePaletteShortcut(useCallback(() => setPaletteOpen((open) => !open), []));
  return (
    <header className="flex h-12 flex-none items-center gap-2 border-b border-line bg-surface px-3">
      {showMenu && (
        <button
          type="button"
          className={navButton({ class: "md:hidden" })}
          aria-label={t`메뉴`}
          aria-expanded={menuOpen}
          aria-controls="feed-sidebar"
          onClick={onToggleMenu}
        >
          <MenuIcon size={16} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="inline-flex h-7.5 w-full max-w-80 min-w-0 cursor-pointer items-center gap-2 rounded-md border border-line bg-panel px-2.5 text-ui text-fg-muted hover:bg-panel-hover"
        aria-keyshortcuts="Control+K Meta+K"
        aria-haspopup="dialog"
        onClick={openPalette}
      >
        <Search size={14} aria-hidden="true" />
        <span className="truncate whitespace-nowrap">{t`검색·명령`}</span>
        <kbd className="ml-auto hidden rounded-xs border border-line px-1 font-sans text-2xs sm:inline">
          Ctrl K
        </kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href={FEED.new}
          aria-label={i18n._(NEW_POST)}
          className={button({
            variant: "primary",
            size: "sm",
            class: "whitespace-nowrap no-underline",
          })}
        >
          <Plus size={14} aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">
            <StableText {...inAllLocales(NEW_POST)} />
          </span>
        </Link>
        <AiBadge />
        <PreferencesMenu />
        <UserSwitcher />
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </header>
  );
}

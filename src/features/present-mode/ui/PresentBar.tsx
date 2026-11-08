"use client";

import { Presentation, X } from "lucide-react";
import { usePresentNav } from "@/features/present-mode/model/present-nav";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { button } from "@/shared/ui/button";

const messages = defineMessages({
  ko: {
    title: "발표 모드",
    hint: "←/→ 게시물 넘기기 · Esc 보고서로",
    end: "발표 끝내기",
  },
  en: {
    title: "Present mode",
    hint: "←/→ next/prev post · Esc to report",
    end: "End presentation",
  },
});

/** 발표 모드의 상단 바: 검색·새 게시물·사용자 전환 대신 "발표 끝내기"만 둔다. */
export function PresentBar() {
  const text = useT(messages);
  const { end } = usePresentNav();
  return (
    <header className="flex h-12 flex-none items-center gap-2 border-b border-line bg-surface px-4">
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-fg-secondary">
        <Presentation size={16} aria-hidden="true" />
        {text.title}
      </span>
      <span className="hidden truncate text-xs whitespace-nowrap text-fg-muted sm:inline">
        {text.hint}
      </span>
      <button
        type="button"
        className={button({ size: "sm", class: "ml-auto whitespace-nowrap" })}
        onClick={end}
      >
        <X size={14} aria-hidden="true" />
        {text.end}
      </button>
    </header>
  );
}

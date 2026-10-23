"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { openQuickCreate } from "@/features/create-post/ui/quick-create";
import { useOpenPeek } from "@/shared/lib/peek";
import { cn } from "@/shared/lib/tw";
import { FeedSidebar } from "@/widgets/feed-sidebar/ui/FeedSidebar";
import { PostPeek } from "@/widgets/post-detail/ui/PostPeek";
import { FeedTopBar } from "./FeedTopBar";
import { useSchedulerTick } from "./use-scheduler-tick";

/** 발표 모드(?present=1): 사이드바를 숨기고 글씨를 키운다. */
export const usePresentMode = () => useSearchParams().get("present") === "1";

/** 입력 중이 아닐 때 C: 빠른 생성 (지금 보고 있는 그룹을 기본값으로) */
function useQuickCreateKey() {
  const group = useSearchParams().get("g") ?? undefined;
  const openPeek = useOpenPeek();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']"))
        return;
      e.preventDefault();
      openQuickCreate({ groupId: group, onCreated: openPeek });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [group, openPeek]);
}

/**
 * 피드 화면 틀: 왼쪽 사이드바 + 상단 바 + 본문.
 * 48rem보다 좁으면 사이드바는 메뉴 버튼으로 여닫는 서랍이 된다.
 */
export function FeedShell({
  notice,
  children,
}: {
  /** 본문 위 안내 한 줄 (사용자 목록을 못 받았을 때 등) */
  notice?: ReactNode;
  children: ReactNode;
}) {
  const present = usePresentMode();
  const [open, setOpen] = useState(false);
  useSchedulerTick();
  useQuickCreateKey();

  return (
    <div className="flex h-dvh bg-surface text-fg">
      {!present && (
        <>
          {open && (
            <button
              type="button"
              className="z-drawer fixed inset-0 cursor-default bg-backdrop md:hidden"
              aria-label="메뉴 닫기"
              onClick={() => setOpen(false)}
            />
          )}
          <aside
            id="feed-sidebar"
            data-open={open || undefined}
            className="z-drawer invisible fixed inset-y-0 left-0 w-60 -translate-x-full border-r border-line bg-panel shadow-drawer transition-transform data-open:visible data-open:translate-x-0 md:visible md:static md:flex-none md:translate-x-0 md:shadow-none"
            // 서랍에서 링크를 고르거나 Esc를 누르면 닫는다.
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            <FeedSidebar />
          </aside>
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <FeedTopBar
          showMenu={!present}
          menuOpen={open}
          onToggleMenu={() => setOpen((v) => !v)}
        />
        {notice}
        <main
          className={cn(
            "min-h-0 flex-1 overflow-auto",
            present ? "text-base" : "text-ui",
          )}
        >
          {children}
        </main>
      </div>
      <PostPeek />
    </div>
  );
}

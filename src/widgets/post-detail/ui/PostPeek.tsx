"use client";

// 옆 패널: ?peek=<키>가 있으면 화면 오른쪽에 게시물 상세를 띄운다. FeedShell이 한 번 붙인다.
// 모달이 아니라 뒤의 목록을 그대로 쓸 수 있고, Esc나 닫기 버튼으로 peek만 지운다.

import { Trans, useLingui } from "@lingui/react/macro";
import { Maximize2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { postPageHref } from "@/entities/post/ui/PostLink";
import { useOpenPeek, usePeekKey } from "@/shared/lib/peek";
import { cn } from "@/shared/lib/tw";
import { button, toolButton } from "@/shared/ui/button";
import { PostDetail } from "./PostDetail";
import "../config/messages";

/** 다른 팝업(dialog·popover·메뉴·멘션 목록 등)이 떠 있어 Esc를 그쪽이 받아야 할 때. 보이는 것만 센다 */
const OVERLAYS =
  "dialog[open], :popover-open, [data-popup-open], [role=listbox], [role=menu]";
const overlayOpen = () =>
  [...document.querySelectorAll<HTMLElement>(OVERLAYS)].some(
    (el) => el.checkVisibility?.() ?? true,
  );

/** 입력 칸·편집기(Tiptap)처럼 Esc를 스스로 쓰는 곳 */
const isEditable = (el: Element | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || !!el.closest("input, textarea, select"));

export function PostPeek() {
  const { t } = useLingui();
  const key = usePeekKey();
  const openPeek = useOpenPeek();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!key) return;
    // capture 단계에서 본다: 안쪽 handler가 전파를 막아도 받고, popover가 닫히기 전에 열림을 확인한다
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing || overlayOpen()) return;
      // 입력 중이면 패널을 닫지 않고 입력에서만 빠진다 (한 번 더 누르면 닫힌다)
      if (isEditable(document.activeElement)) {
        if (ref.current?.contains(document.activeElement))
          ref.current.focus({ preventScroll: true });
        return;
      }
      openPeek(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [key, openPeek]);

  // 다른 게시물을 열면 패널 맨 위로 돌아가 포커스를 옮긴다.
  useEffect(() => {
    if (!key || !ref.current) return;
    ref.current.scrollTop = 0;
    ref.current.focus({ preventScroll: true });
  }, [key]);

  if (!key) return null;

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={t`게시물 ${key}`}
      className="z-drawer fixed inset-y-0 right-0 flex w-full flex-col overflow-y-auto border-l border-line bg-surface text-ui shadow-drawer outline-none md:w-160"
    >
      <div className="p-5">
        <PostDetail
          key={key}
          postKey={key}
          mode="panel"
          onDeleted={() => openPeek(null)}
          toolbar={
            <div className="flex items-center justify-between gap-2">
              <Link href={postPageHref(key)} className={button({ size: "sm" })}>
                <Maximize2 size={13} aria-hidden="true" />
                <Trans>전체 페이지로</Trans>
              </Link>
              <button
                type="button"
                className={cn(toolButton())}
                aria-label={t`옆 패널 닫기`}
                title={t`닫기 (Esc)`}
                onClick={() => openPeek(null)}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          }
        />
      </div>
    </aside>
  );
}

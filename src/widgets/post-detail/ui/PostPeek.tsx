"use client";

// 옆 패널: ?peek=<키>가 있으면 화면 오른쪽에 게시물 상세를 띄운다. FeedShell이 한 번 붙인다.
// 모달이 아니라 뒤의 목록을 그대로 쓸 수 있고, Esc나 닫기 버튼으로 peek만 지운다.

import { Maximize2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { postPageHref } from "@/entities/post/ui/PostLink";
import { useOpenPeek, usePeekKey } from "@/shared/lib/peek";
import { cn } from "@/shared/lib/tw";
import { button, toolButton } from "@/shared/ui/button";
import { PostDetail } from "./PostDetail";

/** 다른 팝업(dialog·select 목록)이 Esc를 받아야 할 때 */
const overlayOpen = () =>
  !!document.querySelector("dialog[open], [data-popup-open], [role=listbox]");

export function PostPeek() {
  const key = usePeekKey();
  const openPeek = useOpenPeek();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!key) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || overlayOpen()) return;
      openPeek(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
      aria-label={`게시물 ${key}`}
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
                전체 페이지로
              </Link>
              <button
                type="button"
                className={cn(toolButton())}
                aria-label="옆 패널 닫기"
                title="닫기 (Esc)"
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

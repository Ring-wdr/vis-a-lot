import { tv } from "@/shared/lib/tw";

/**
 * 상단 바의 화면 버튼·링크. 작업 화면(AppHeader)과 공유 페이지가 같은 모양을 쓴다.
 * 고른 화면은 버튼이면 aria-selected, 링크면 aria-current로 표시하고, hover 중에는 hover 바탕을 보인다.
 */
export const navButton = tv({
  base: "inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2.5 text-ui text-fg-secondary enabled:hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45 aria-selected:border-line aria-selected:font-semibold aria-selected:text-fg aria-selected:not-hover:bg-elevated",
});

export const navLink = tv({
  base: "inline-flex h-7.5 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-ui text-fg-secondary no-underline hover:bg-panel aria-[current=page]:border-line aria-[current=page]:font-semibold aria-[current=page]:text-fg aria-[current=page]:not-hover:bg-elevated",
});

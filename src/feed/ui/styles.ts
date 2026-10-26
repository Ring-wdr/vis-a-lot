// 피드 화면이 함께 쓰는 모양. 피드 밖과 공유할 일이 생기면 src/shared/ui로 옮긴다.

import { tv } from "@/shared/lib/tw";

/** 사이드바 링크. 지금 화면은 aria-current="page"로 표시한다. */
export const sideLink = tv({
  base: "flex h-7.5 min-w-0 items-center gap-2 rounded-md px-2 text-ui text-fg-secondary no-underline hover:bg-panel-hover aria-[current=page]:font-semibold aria-[current=page]:text-accent aria-[current=page]:not-hover:bg-accent-soft",
});

/** 사이드바 구역 제목 */
export const sideHeading = tv({
  base: "mt-4 mb-1 truncate px-2 text-2xs font-semibold text-fg-muted",
});

/** 개수 배지 (안읽음 등) */
export const countBadge = tv({
  base: "ml-auto inline-grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-3xs font-semibold text-on-accent",
});

/** base-ui Menu 목록 */
export const menuStyles = tv({
  slots: {
    positioner: "z-menu outline-0",
    popup:
      "max-h-[min(28rem,calc(100dvh-4rem))] min-w-60 overflow-auto rounded-lg border border-line bg-elevated p-1 text-ui shadow-xl outline-0",
    label: "px-2 pt-1.5 pb-1 text-2xs font-semibold text-fg-muted",
    item: "flex cursor-default items-center gap-2.5 rounded-sm px-2 py-1.5 text-fg no-underline outline-0 select-none data-disabled:opacity-40 data-highlighted:bg-accent-soft",
    separator: "my-1 h-px bg-line",
  },
});

/** dev·설정 화면의 본문 틀 */
export const page = tv({
  slots: {
    root: "mx-auto flex w-full max-w-240 flex-col gap-4 p-6",
    title: "text-xl font-bold",
    lead: "text-ui text-fg-secondary",
    section:
      "flex flex-col gap-3 rounded-lg border border-line bg-elevated p-4",
    sectionTitle: "text-sm font-semibold",
    row: "flex flex-wrap items-center gap-2",
  },
});

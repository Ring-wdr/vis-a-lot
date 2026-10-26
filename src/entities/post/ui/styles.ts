// 게시물 상세·빠른 생성·전체 폼이 함께 쓰는 모양.

import { tv } from "@/shared/lib/tw";

/** 상태 배지. 카테고리(열림·멈춤·닫힘)마다 무게를 달리한다 */
export const statusBadge = tv({
  base: "inline-flex h-5.5 flex-none items-center rounded-full border px-2 text-2xs font-semibold whitespace-nowrap",
  variants: {
    status: {
      unresolved: "border-line bg-elevated text-fg-secondary",
      in_progress: "border-accent-line bg-accent-soft text-accent",
      in_review: "border-accent bg-accent-soft-strong text-accent",
      resolved: "border-transparent bg-accent text-on-accent",
      on_hold: "border-line bg-panel-strong text-fg-secondary",
      cancelled: "border-line bg-panel text-fg-muted line-through",
    },
  },
});

/** 작은 표시 (막힘, 자동 등) */
export const chip = tv({
  base: "inline-flex h-5.5 flex-none items-center gap-1 rounded-full px-2 text-2xs font-semibold whitespace-nowrap",
  variants: {
    tone: {
      danger: "bg-danger/12 text-danger",
      muted: "bg-panel text-fg-secondary",
      accent: "bg-accent-soft text-accent",
    },
  },
  defaultVariants: { tone: "muted" },
});

/** 입력 칸 */
export const field = tv({
  base: "h-7.5 w-full min-w-0 rounded-md border border-line bg-elevated px-2 text-ui text-fg placeholder:text-fg-muted focus-visible:border-accent focus-visible:outline-none disabled:bg-panel disabled:text-fg-secondary",
  variants: {
    multiline: { true: "h-auto py-1.5 font-mono text-xs leading-relaxed" },
  },
});

export const detail = tv({
  slots: {
    // 패널(40rem)에서는 한 줄, 넓은 전체 페이지에서는 본문 + 오른쪽 필드
    root: "@container flex min-w-0 flex-col gap-5",
    columns:
      "grid min-w-0 grid-cols-1 gap-6 @3xl:grid-cols-[minmax(0,1fr)_18rem]",
    main: "flex min-w-0 flex-col gap-6",
    side: "flex min-w-0 flex-col gap-4 @3xl:order-last",
    section: "flex min-w-0 flex-col gap-2",
    sectionHead: "flex min-h-6 items-center justify-between gap-2",
    sectionTitle: "text-xs font-semibold text-fg-secondary",
    hint: "text-xs text-fg-muted",
    error: "text-xs text-danger",
    list: "flex flex-col gap-1",
    row: "flex min-w-0 items-center gap-2",
  },
});

/** 필드 패널의 한 줄: 이름 + 값 */
export const fieldRow = tv({
  slots: {
    root: "flex min-w-0 flex-col gap-1",
    label: "text-xs text-fg-secondary",
    value: "min-w-0 text-ui",
  },
});

// 그룹 설정·관리 콘솔이 함께 쓰는 모양.

import { tv } from "@/shared/lib/tw";

export const settings = tv({
  slots: {
    root: "mx-auto flex w-full max-w-240 min-w-0 flex-col gap-4 p-4 sm:p-6",
    head: "flex min-w-0 flex-col gap-1",
    title: "text-xl font-bold",
    lead: "text-ui text-fg-secondary",
    section:
      "flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-elevated p-4",
    sectionHead: "flex min-w-0 flex-wrap items-center justify-between gap-2",
    sectionTitle: "text-sm font-semibold",
    hint: "text-xs text-fg-muted",
    warn: "rounded-md bg-accent-soft px-2.5 py-1.5 text-xs text-fg-secondary",
    label: "flex min-w-0 flex-col gap-1 text-xs text-fg-secondary",
    list: "flex min-w-0 flex-col rounded-md border border-line",
    item: "flex min-w-0 flex-wrap items-center gap-2 border-line px-2.5 py-2 not-first:border-t",
    itemName: "min-w-0 flex-1 truncate text-ui",
    actions: "ml-auto flex flex-none items-center gap-1",
    addRow: "flex min-w-0 flex-wrap items-end gap-2",
  },
});

/** 작은 아이콘 버튼 (이름 바꾸기·지우기·순서) */
export const iconButton = tv({
  base: "inline-grid size-7 flex-none cursor-pointer place-items-center rounded-md border border-transparent text-fg-secondary hover:border-line hover:bg-panel disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent",
  variants: {
    tone: { danger: "hover:text-danger", default: "" },
  },
  defaultVariants: { tone: "default" },
});

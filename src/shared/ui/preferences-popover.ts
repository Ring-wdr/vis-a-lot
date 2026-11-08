import { tv } from "@/shared/lib/tw";

/**
 * 상단 바의 설정 팝오버(사용자 메뉴, 화면 설정). 폭을 고정해 언어를 바꿔도 크기가 바뀌지 않게 하고,
 * 줄바꿈 없이 한 줄씩 둔다.
 */
export const preferencesPopover = tv({
  slots: {
    trigger:
      "inline-flex h-7.5 max-w-48 min-w-0 cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-1.5 text-ui text-fg-secondary hover:bg-panel data-popup-open:border-line data-popup-open:bg-elevated",
    positioner: "z-popover outline-0",
    popup:
      "flex w-72 flex-col gap-3 rounded-lg border border-line bg-elevated p-3 text-ui shadow-xl outline-0",
    section: "flex min-w-0 flex-col",
    label:
      "mb-1.5 truncate text-2xs font-semibold whitespace-nowrap text-fg-muted",
    separator: "-mx-3 h-px flex-none bg-line",
  },
});

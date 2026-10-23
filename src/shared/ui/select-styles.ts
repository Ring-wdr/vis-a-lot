import { tv } from "@/shared/lib/tw";

/** 단일 선택(Select), 다중 선택(OrderedSelect), grid 피커가 같이 쓰는 필드 모양 */
export const selectStyles = tv({
  slots: {
    field: "flex min-w-0 flex-col gap-1 text-ui",
    labelRow: "mb-0.5 flex min-w-0 items-baseline justify-between gap-2",
    label: "text-xs text-fg-secondary",
    // 높이를 한 줄로 고정한다. 고른 값이 길면 말줄임으로 자른다.
    trigger:
      "flex h-7.5 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-elevated pr-1.5 pl-2 text-left text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent enabled:hover:border-line-strong disabled:cursor-default disabled:bg-panel data-popup-open:border-accent",
    value: "min-w-0 flex-1 truncate",
    placeholder: "text-fg-muted",
    // 아이콘이 있는 값(트리거). 아이콘은 줄 높이에 맞추고 라벨만 말줄임한다.
    iconLabel: "flex min-w-0 items-center gap-1.5",
    icon: "inline-flex flex-none text-fg-secondary",
    // 다중 선택에서 고른 개수
    count:
      "inline-grid h-4.5 min-w-4.5 flex-none place-items-center rounded-full bg-accent px-1 text-2xs text-on-accent tabular-nums",
    chevron: "inline-grid flex-none place-items-center text-fg-muted",
    positioner: "z-popover outline-none",
    popup:
      "max-h-[min(20rem,var(--available-height))] w-[max(var(--anchor-width),10rem)] max-w-(--available-width) overflow-x-hidden overflow-y-auto rounded-lg border border-line bg-elevated py-1 text-ui text-fg shadow-lg outline-none",
    item: "flex h-7 cursor-default items-center gap-1.5 px-2 outline-none select-none data-disabled:text-fg-muted data-highlighted:not-data-selected:bg-panel data-selected:bg-accent-soft",
    check:
      "inline-grid w-3.5 flex-none place-items-center text-2xs text-accent",
    itemLabel: "flex-1 truncate",
    aside: "truncate text-2xs text-fg-muted tabular-nums",
  },
});

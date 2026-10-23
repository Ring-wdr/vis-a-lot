import { tv } from "@/shared/lib/tw";

/** 전체 설정과 item 개별 속성 팝업: 왼쪽 구역 메뉴 + 오른쪽 내용 */
export const settingsDialog = tv({
  slots: {
    dialog: "w-[min(40rem,calc(100vw-2rem))] max-w-none",
    body: "flex flex-col gap-3.5",
    title: "text-base font-bold",
    // 높이를 정해 두고 메뉴와 내용이 각자 스크롤한다. 높이가 내용을 따라가면 긴 구역(축)이
    // 팝업 밖으로 넘치고, 구역을 바꿀 때마다 팝업 높이가 바뀐다.
    layout:
      "grid h-[min(65vh,36rem)] grid-cols-[9.375rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4",
    menu: "flex flex-col gap-0.5 overflow-y-auto border-r border-line pr-3",
    menuItem:
      "flex cursor-pointer items-center gap-2 rounded-md p-2 text-left text-ui text-fg-secondary not-aria-current:hover:bg-panel aria-current:bg-accent-soft aria-current:font-semibold aria-current:text-accent",
    content: "min-w-0 overflow-y-auto pr-1",
    row: "flex items-center gap-2 text-fg-secondary",
    input: "w-18 rounded-md border border-line bg-elevated px-2 py-1 text-fg",
  },
});

import { tv } from "@/shared/lib/tw";

/** 전체 설정과 item 개별 속성 팝업: 왼쪽 구역 메뉴 + 오른쪽 내용 */
export const settingsDialog = tv({
  slots: {
    dialog: "w-[min(40rem,calc(100vw-2rem))] max-w-none",
    body: "flex flex-col gap-3.5",
    title: "text-base font-bold",
    layout:
      "grid max-h-[min(70vh,40rem)] min-h-55 grid-cols-[9.375rem_minmax(0,1fr)] gap-4",
    menu: "flex flex-col gap-0.5 overflow-y-auto border-r border-line pr-3",
    menuItem:
      "flex cursor-pointer items-center gap-2 rounded-md p-2 text-left text-ui text-fg-secondary not-aria-current:hover:bg-panel aria-current:bg-accent-soft aria-current:font-semibold aria-current:text-accent",
    content: "min-w-0 overflow-y-auto pr-1",
    // 구역 안의 묶음 (색상, 연결 문자, 가까운 점 …)
    section: "flex flex-col gap-2.5 text-ui",
    heading: "text-ui font-semibold",
    row: "flex items-center gap-2 text-fg-secondary",
    input:
      "w-18 rounded-md border border-line bg-elevated px-2 py-1 leading-[inherit] text-fg",
  },
});

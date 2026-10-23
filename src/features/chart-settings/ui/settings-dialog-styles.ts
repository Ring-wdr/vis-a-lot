import { tv } from "@/shared/lib/tw";

/** 전체 설정과 item 개별 속성 팝업: 왼쪽 구역 메뉴 + 오른쪽 내용 */
export const settingsDialog = tv({
  slots: {
    dialog: "w-[min(640px,calc(100vw-32px))] max-w-none",
    body: "flex flex-col gap-3.5",
    title: "font-bold text-16",
    layout:
      "grid max-h-[min(70vh,640px)] min-h-55 grid-cols-[150px_minmax(0,1fr)] gap-4",
    menu: "flex flex-col gap-0.5 overflow-y-auto border-line border-r pr-3",
    menuItem:
      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.75 text-left text-13 text-fg-secondary not-aria-[current=true]:hover:bg-panel aria-[current=true]:bg-accent-soft aria-[current=true]:font-semibold aria-[current=true]:text-accent",
    content: "min-w-0 overflow-y-auto pr-1",
    // 구역 안의 묶음 (색상, 연결 문자, 가까운 점 …)
    section: "flex flex-col gap-2.5 text-13",
    heading: "font-semibold text-13",
    row: "flex items-center gap-2 text-fg-secondary",
    input:
      "w-18 rounded-md border border-line bg-elevated px-2 py-1.25 text-fg leading-[inherit]",
  },
});

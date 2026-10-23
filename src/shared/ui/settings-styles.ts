import { tv } from "@/shared/lib/tw";

/** 공통 색 설정, item 설정 팝업, item 개별 속성 팝업이 같이 쓰는 묶음과 legend 색 목록 */
export const settingsStyles = tv({
  slots: {
    popoverBody: "flex flex-col gap-2.5 text-ui",
    group: "flex flex-col items-start gap-2",
    groupTitle: "font-semibold text-fg-secondary text-xs",
    legendList: "flex flex-col gap-1.5",
    legendItem: "flex items-center gap-2 text-xs",
    legendSwatch:
      "size-4.5 cursor-pointer rounded-full border-2 border-elevated ring-1 ring-line",
    legendSwatchSkeleton: "size-4.5 flex-none rounded-full",
  },
});

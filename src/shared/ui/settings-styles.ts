import { tv } from "@/shared/lib/tw";

/** 전체 설정과 item 속성 팝업이 같이 쓰는 묶음과 legend 색 목록 */
export const settingsStyles = tv({
  slots: {
    popoverBody: "flex flex-col gap-2.5 text-ui",
    // 설정 팝업 구역 안의 묶음 (색상, legend 위치, 연결 문자 …)
    section: "flex flex-col gap-2.5 text-ui",
    heading: "text-ui font-semibold",
    legendList: "flex flex-col gap-1.5",
    legendItem: "flex items-center gap-2 text-xs",
    legendSwatch:
      "size-4.5 cursor-pointer rounded-full border-2 border-elevated ring-1 ring-line",
    legendSwatchSkeleton: "size-4.5 flex-none rounded-full",
  },
});

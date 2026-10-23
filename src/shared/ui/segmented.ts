import { tv } from "@/shared/lib/tw";

/** 붙어 있는 선택 버튼 묶음. 고른 버튼은 aria-pressed로 표시한다. */
export const segmented = tv({
  slots: {
    // 팝업의 세로 묶음(items-start) 안에서도 폭을 다 쓴다.
    root: "flex min-w-0 self-stretch",
    item: "not-first:-ml-px inline-flex flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap border border-line bg-elevated px-1.5 py-1.25 text-fg-secondary text-xs leading-[inherit] first:rounded-l-md last:rounded-r-md disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:relative aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent",
  },
});

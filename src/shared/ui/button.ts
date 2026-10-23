import { tv } from "@/shared/lib/tw";

/**
 * 글자가 있는 버튼. 도구 줄·패널(sm), 팝업 하단(md), 패널 하단의 draw·cancel(lg)에서 같은 모양을 쓴다.
 * primary는 투명한 테두리를 두어 테두리 있는 버튼과 같은 크기가 된다.
 */
export const button = tv({
  base: "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md disabled:cursor-not-allowed disabled:opacity-50",
  variants: {
    variant: {
      primary: "border border-transparent bg-accent text-on-accent",
      secondary: "border border-line bg-elevated text-fg",
      danger: "border border-danger bg-elevated text-danger",
    },
    size: {
      sm: "px-2.5 py-1 text-ui",
      md: "px-3.5 py-1.5",
      lg: "gap-2 px-3 py-2 font-semibold",
    },
  },
  defaultVariants: { variant: "secondary", size: "md" },
});

/** 글자만 있는 버튼. 다시 보기 전용 패널(<fieldset disabled>, group/controls)에서는 숨긴다. */
export const linkButton = tv({
  base: "inline-flex cursor-pointer items-center gap-1 self-start text-xs text-accent group-disabled/controls:hidden",
});

/** 도구 줄의 아이콘 버튼(모드, 차트 도구). 켜진 상태는 aria-pressed로 표시한다. */
export const toolButton = tv({
  base: "inline-grid h-7.5 w-8 cursor-pointer place-items-center rounded-md border border-line bg-elevated text-ui disabled:cursor-not-allowed disabled:text-fg-muted disabled:opacity-40 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent",
});

/**
 * item 위 도구 줄의 작은 아이콘 버튼. 켜진 상태는 aria-pressed로 표시하고,
 * 커서를 올리면 켜진 버튼도 hover 바탕을 보인다.
 */
export const itemButton = tv({
  base: "inline-grid h-5.5 w-6 cursor-pointer place-items-center rounded-sm border border-transparent text-ui text-fg-secondary enabled:hover:border-line enabled:hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-35 aria-pressed:text-accent aria-pressed:not-hover:border-accent aria-pressed:not-hover:bg-accent-soft",
});

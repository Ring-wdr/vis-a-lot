import { type CnOptions, cnMerge, createTV } from "tailwind-variants";

/**
 * app/globals.css의 @theme 토큰 중 Tailwind 기본에 없는 이름. tailwind-merge는 모르는 `text-ui`를
 * 색으로 읽어 `text-fg`와 충돌한다고 보고 하나를 지우므로, 글자 크기·그림자 이름을 알려 준다.
 */
const twMergeConfig = {
  extend: {
    theme: {
      text: ["ui"],
      shadow: ["card", "drawer"],
    },
  },
};

/** 조건부 클래스를 합치고, 겹치는 Tailwind 클래스는 뒤의 것만 남긴다. */
export function cn(...classes: CnOptions): string {
  return cnMerge(...classes)({ twMergeConfig }) ?? "";
}

/** 변형(variant)이 있는 클래스 묶음. 같은 tailwind-merge 설정을 쓴다. */
export const tv = createTV({ twMergeConfig });

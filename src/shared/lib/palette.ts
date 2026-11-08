// 서버 렌더러와 같은 팔레트. 서버가 그린 실제 색은 item 상태(color)로 오고,
// 여기 값은 그리기 전 미리 보기(공통 속성, legend 기본 색)에만 쓴다.

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { linguiFor } from "@/shared/lib/i18n";
import "@/shared/config/messages";

export const PALETTE = [
  { key: "blue", hex: "#2a78d6" },
  { key: "orange", hex: "#eb6834" },
  { key: "teal", hex: "#1baf7a" },
  { key: "yellow", hex: "#eda100" },
  { key: "pink", hex: "#e87ba4" },
  { key: "green", hex: "#008300" },
  { key: "purple", hex: "#6250d6" },
  { key: "red", hex: "#e34948" },
] as const;

type PaletteKey = (typeof PALETTE)[number]["key"];

const COLOR_NAMES: Record<PaletteKey, MessageDescriptor> = {
  blue: msg`파랑`,
  orange: msg`주황`,
  teal: msg`청록`,
  yellow: msg`노랑`,
  pink: msg`분홍`,
  green: msg`초록`,
  purple: msg`보라`,
  red: msg`빨강`,
};

/** legend 값의 기본 색: 전체 legend 값 목록에서의 순서대로 팔레트 슬롯을 준다. */
export function defaultLegendColor(index: number) {
  return PALETTE[index % PALETTE.length].hex;
}

/** 팔레트 색이면 지금 언어의 이름, 아니면 hex 그대로. 그리는 컴포넌트는 useLocale로 구독한다. */
export function colorName(hex: string) {
  const key = PALETTE.find(
    (c) => c.hex.toLowerCase() === hex.toLowerCase(),
  )?.key;
  return key ? linguiFor()._(COLOR_NAMES[key]) : hex;
}

// 서버 렌더러와 같은 팔레트. 서버가 그린 실제 색은 item 상태(color)로 오고,
// 여기 값은 그리기 전 미리 보기(공통 속성, legend 기본 색)에만 쓴다.

import { defineMessages, t } from "@/shared/lib/i18n";

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

const messages = defineMessages<Record<PaletteKey, string>>({
  ko: {
    blue: "파랑",
    orange: "주황",
    teal: "청록",
    yellow: "노랑",
    pink: "분홍",
    green: "초록",
    purple: "보라",
    red: "빨강",
  },
  en: {
    blue: "Blue",
    orange: "Orange",
    teal: "Teal",
    yellow: "Yellow",
    pink: "Pink",
    green: "Green",
    purple: "Purple",
    red: "Red",
  },
});

/** legend 값의 기본 색: 전체 legend 값 목록에서의 순서대로 팔레트 슬롯을 준다. */
export function defaultLegendColor(index: number) {
  return PALETTE[index % PALETTE.length].hex;
}

/** 팔레트 색이면 지금 언어의 이름, 아니면 hex 그대로. 그리는 컴포넌트는 useLocale로 구독한다. */
export function colorName(hex: string) {
  const key = PALETTE.find(
    (c) => c.hex.toLowerCase() === hex.toLowerCase(),
  )?.key;
  return key ? t(messages)[key] : hex;
}

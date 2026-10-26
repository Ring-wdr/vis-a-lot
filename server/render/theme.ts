// 서버 렌더 차트의 색과 치수. dataviz 기본 팔레트(light)를 따른다.

export const THEME = {
  surface: "#fcfcfb",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  textMuted: "#8a8984",
  grid: "#e7e6e2",
  axis: "#c9c8c2",
  /** 선택 영역 테두리 */
  selection: "#2a78d6",
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

/**
 * dataviz 기본 categorical 팔레트(light). 슬롯 순서가 색각 이상 대비 안전성의 근거이므로
 * 돌려쓰지 않고 순서대로 쓴다. legend 컬럼을 고유값 8개 이하로 제한한 이유다.
 */
export const PALETTE = [
  { name: "파랑", hex: "#2a78d6" },
  { name: "주황", hex: "#eb6834" },
  { name: "청록", hex: "#1baf7a" },
  { name: "노랑", hex: "#eda100" },
  { name: "분홍", hex: "#e87ba4" },
  { name: "초록", hex: "#008300" },
  { name: "보라", hex: "#6250d6" },
  { name: "빨강", hex: "#e34948" },
] as const;

/** categorical 1번 슬롯. 공통 속성의 기본 색. */
export const DEFAULT_SERIES_COLOR = PALETTE[0].hex;

/** legend 값의 기본 색: 전체 legend 값 목록에서의 순서대로 팔레트 슬롯을 준다. */
export function defaultLegendColor(index: number) {
  return PALETTE[index % PALETTE.length].hex;
}

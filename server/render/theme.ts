// 서버 렌더 차트의 색과 치수. dataviz 기본 팔레트(light)를 따른다.

export const THEME = {
  surface: "#fcfcfb",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  textMuted: "#8a8984",
  grid: "#e7e6e2",
  axis: "#c9c8c2",
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

/** categorical 1번 슬롯. 공통 속성의 기본 색. */
export const DEFAULT_SERIES_COLOR = "#2a78d6";

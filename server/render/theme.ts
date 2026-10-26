// 서버 렌더 차트의 색과 치수. dataviz 기본 팔레트를 따른다.

import type { ChartTheme } from "../api/types";

type ThemeColors = {
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  grid: string;
  axis: string;
  /** 선택 영역 테두리 */
  selection: string;
  /** 사용자가 그린 도형의 선 */
  ink: string;
  /** 사용자가 그린 사각형 안쪽 */
  inkSoft: string;
  font: string;
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** 바탕·글자 색은 화면 토큰(app/globals.css)과 같은 값이라 PNG가 item 카드(bg-surface)와 이어져 보인다. */
const THEMES: Record<ChartTheme, ThemeColors> = {
  light: {
    surface: "#fcfcfb",
    textPrimary: "#0b0b0b",
    textSecondary: "#52514e",
    textMuted: "#8a8984",
    grid: "#e7e6e2",
    axis: "#c9c8c2",
    selection: "#2a78d6",
    ink: "#0b0b0b",
    inkSoft: "rgba(11, 11, 11, 0.06)",
    font: FONT,
  },
  dark: {
    surface: "#141413",
    textPrimary: "#ecebe8",
    textSecondary: "#b5b4ae",
    textMuted: "#8a8984",
    grid: "#363632",
    axis: "#55544f",
    selection: "#4d8fe6",
    ink: "#ecebe8",
    inkSoft: "rgba(236, 235, 232, 0.08)",
    font: FONT,
  },
};

/**
 * 지금 그리는 PNG의 테마 색. 렌더러는 이 값을 읽고, drawPng가 그리기 직전에 applyTheme으로 바꾼다.
 * 그리기(draw)는 동기 함수라 Worker 안에서 두 렌더가 섞이지 않는다.
 */
export const THEME: ThemeColors = { ...THEMES.light };

export function applyTheme(theme: ChartTheme = "light") {
  Object.assign(THEME, THEMES[theme]);
}

/**
 * 데이터 색 위에 얹는 글자 색. 바탕 테마와 상관없이 칠한 면의 밝기로만 고르므로 테마 색을 쓰지 않는다.
 * (THEME.textPrimary는 다크 테마에서 밝은 색이라 밝은 면 위에서 보이지 않는다.)
 */
export const INK_ON_LIGHT = THEMES.light.textPrimary;
export const INK_ON_DARK = "#ffffff";

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

// 서버 렌더러와 같은 팔레트. 서버가 그린 실제 색은 item 상태(color)로 오고,
// 여기 값은 그리기 전 미리 보기(공통 속성, legend 기본 색)에만 쓴다.

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

/** 공통 속성의 기본 색 */
export const DEFAULT_SERIES_COLOR = PALETTE[0].hex;

/** legend 값의 기본 색: 전체 legend 값 목록에서의 순서대로 팔레트 슬롯을 준다. */
export function defaultLegendColor(index: number) {
  return PALETTE[index % PALETTE.length].hex;
}

export function colorName(hex: string) {
  return (
    PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex
  );
}

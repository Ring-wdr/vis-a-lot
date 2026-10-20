// dataviz 기본 categorical 팔레트(light). 슬롯 순서가 색각 이상 대비 안전성의 근거이므로 순서대로 쓴다.

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

export function colorName(hex: string) {
  return (
    PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex
  );
}

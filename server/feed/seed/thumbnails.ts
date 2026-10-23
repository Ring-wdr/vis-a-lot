// 시드 썸네일. 외부 URL 없이 코드로 그린 작은 SVG를 data URL로 만든다 (각 2KB 안쪽).

import type { Random } from "./random";

const W = 160;
const H = 100;

function svgUrl(body: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}'>${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const hsl = (h: number, s: number, l: number) => `hsl(${h},${s}%,${l}%)`;

/** 막대·꺾은선 차트. series 값은 0~100 */
export function chartThumbnail(kind: "bar" | "line", series: number[]) {
  const n = series.length;
  const step = (W - 24) / n;
  const y = (v: number) => Math.round(H - 12 - (v / 100) * (H - 28));
  const grid = [30, 55, 80]
    .map((gy) => `<path d='M12 ${gy}H${W - 12}' stroke='#e2e8f0'/>`)
    .join("");
  const marks =
    kind === "bar"
      ? series
          .map(
            (v, i) =>
              `<rect x='${Math.round(14 + i * step)}' y='${y(v)}' width='${Math.round(step * 0.6)}' height='${H - 12 - y(v)}' rx='2' fill='#3e63dd'/>`,
          )
          .join("")
      : `<polyline points='${series
          .map((v, i) => `${Math.round(16 + i * step)},${y(v)}`)
          .join(
            " ",
          )}' fill='none' stroke='#12a594' stroke-width='3' stroke-linejoin='round'/>`;
  return svgUrl(
    `<rect width='${W}' height='${H}' fill='#f8fafc'/>${grid}${marks}`,
  );
}

/** 그라데이션 배경 + 해·산 도형 */
export function imageThumbnail(random: Random) {
  const hue = random.int(0, 359);
  const peak = random.int(50, 110);
  return svgUrl(
    `<defs><linearGradient id='g' x2='1' y2='1'><stop stop-color='${hsl(hue, 70, 72)}'/><stop offset='1' stop-color='${hsl((hue + 60) % 360, 65, 52)}'/></linearGradient></defs>` +
      `<rect width='${W}' height='${H}' fill='url(#g)'/>` +
      `<circle cx='${random.int(24, 56)}' cy='${random.int(22, 36)}' r='12' fill='#fff' fill-opacity='.8'/>` +
      `<path d='M0 ${H}L${peak - 40} 55L${peak} ${H}Z' fill='#fff' fill-opacity='.35'/>` +
      `<path d='M${peak - 20} ${H}L${peak + 25} 45L${W} ${H}Z' fill='#fff' fill-opacity='.55'/>`,
  );
}

/** 어두운 화면 + 재생 버튼 */
export function videoThumbnail(random: Random) {
  const hue = random.int(190, 260);
  return svgUrl(
    `<rect width='${W}' height='${H}' fill='${hsl(hue, 30, 12)}'/>` +
      `<rect x='0' y='${H - 6}' width='${random.int(30, 120)}' height='6' fill='#e5484d'/>` +
      `<circle cx='80' cy='47' r='20' fill='#fff' fill-opacity='.15'/>` +
      `<path d='M73 36L93 47L73 58Z' fill='#fff'/>`,
  );
}

/** 편집기처럼 보이는 어두운 화면과 코드 줄 */
export function codeThumbnail(random: Random) {
  const colors = ["#7dd3fc", "#c4b5fd", "#86efac", "#fda4af", "#e2e8f0"];
  const lines = Array.from({ length: 7 }, (_, i) => {
    const indent = random.int(0, 2) * 10;
    return `<rect x='${14 + indent}' y='${14 + i * 11}' width='${random.int(30, 110 - indent)}' height='5' rx='2' fill='${random.pick(colors)}'/>`;
  }).join("");
  return svgUrl(
    `<rect width='${W}' height='${H}' rx='6' fill='#1e1e2e'/>${lines}`,
  );
}

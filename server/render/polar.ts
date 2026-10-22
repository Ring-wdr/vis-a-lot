// pie / radar 공용: 이동·확대가 없는 차트의 고정 좌표 공간과 제목 줄.
// 화면의 선택·좌표 변환은 meta.plot + meta.x/y만 보므로, 그림 영역 픽셀과 1:1인 "데이터 좌표"를 준다.
// x = 그림 영역 왼쪽에서의 거리, y = 그림 영역 아래쪽에서의 거리 (y축은 위로 갈수록 커진다).

import type { AxisMeta } from "./scatter";
import { THEME } from "./theme";

type Ctx = OffscreenCanvasRenderingContext2D;

export type Plot = { left: number; top: number; width: number; height: number };

export function fixedSpace(plot: Plot) {
  const bottom = plot.top + plot.height;
  return {
    x: { kind: "number", domain: [0, plot.width] } satisfies AxisMeta,
    y: { kind: "number", domain: [0, plot.height] } satisfies AxisMeta,
    /** PNG 좌표 → 데이터 좌표 */
    toData: (px: number, py: number): [number, number] => [
      px - plot.left,
      bottom - py,
    ],
    /** 데이터 좌표 → PNG 좌표 (선택 영역 그리기) */
    px: (v: number) => plot.left + v,
    py: (v: number) => bottom - v,
  };
}

/** 제목(왼쪽)과 요약(오른쪽) 한 줄. bar/boxplot과 같은 자리·글꼴이다. */
export function drawHeader(
  ctx: Ctx,
  plot: Plot,
  title: string,
  summary: readonly string[],
) {
  ctx.fillStyle = THEME.textPrimary;
  ctx.font = `600 12px ${THEME.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, plot.left, 17, plot.width);
  ctx.fillStyle = THEME.textMuted;
  ctx.font = `11px ${THEME.font}`;
  ctx.textAlign = "right";
  ctx.fillText(summary.filter(Boolean).join(" · "), plot.left + plot.width, 17);
}

/** 그릴 게 없을 때 그림 영역 가운데 안내 문구 */
export function drawEmpty(ctx: Ctx, plot: Plot, text: string) {
  ctx.fillStyle = THEME.textMuted;
  ctx.font = `12px ${THEME.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, plot.left + plot.width / 2, plot.top + plot.height / 2);
}

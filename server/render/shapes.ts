// 차트 위 도형. 위치는 데이터 좌표로 저장해서 확대해도 같은 데이터 위치에 붙어 있다.

import { THEME } from "./theme";

export const SHAPE_TYPES = ["rect", "line", "freehand", "text"] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

export type Shape =
  | { type: "rect"; x0: number; y0: number; x1: number; y1: number }
  | { type: "line"; x0: number; y0: number; x1: number; y1: number }
  | { type: "freehand"; points: [number, number][] }
  | { type: "text"; x: number; y: number; text: string };

type Project = (v: number) => number;
type Ctx = OffscreenCanvasRenderingContext2D;

const STROKE = THEME.textPrimary;
const RECT_FILL = "rgba(11, 11, 11, 0.06)";

/** 데이터 좌표 → PNG 좌표로 투영해 그린다. 그림 영역 clip은 호출하는 쪽에서 건다. */
export function drawShapes(
  ctx: Ctx,
  shapes: readonly Shape[],
  x: Project,
  y: Project,
) {
  ctx.save();
  ctx.strokeStyle = STROKE;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const shape of shapes) {
    switch (shape.type) {
      case "rect": {
        const left = Math.min(x(shape.x0), x(shape.x1));
        const top = Math.min(y(shape.y0), y(shape.y1));
        const w = Math.abs(x(shape.x1) - x(shape.x0));
        const h = Math.abs(y(shape.y1) - y(shape.y0));
        ctx.fillStyle = RECT_FILL;
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);
        break;
      }
      case "line":
        ctx.beginPath();
        ctx.moveTo(x(shape.x0), y(shape.y0));
        ctx.lineTo(x(shape.x1), y(shape.y1));
        ctx.stroke();
        break;
      case "freehand": {
        const [first, ...rest] = shape.points;
        if (!first) break;
        ctx.beginPath();
        ctx.moveTo(x(first[0]), y(first[1]));
        for (const [px, py] of rest) ctx.lineTo(x(px), y(py));
        ctx.stroke();
        break;
      }
      case "text": {
        ctx.font = `600 12px ${THEME.font}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        // 점 위에서도 읽히도록 배경색 테두리를 먼저 그린다.
        ctx.lineWidth = 4;
        ctx.strokeStyle = THEME.surface;
        ctx.strokeText(shape.text, x(shape.x), y(shape.y));
        ctx.fillStyle = THEME.textPrimary;
        ctx.fillText(shape.text, x(shape.x), y(shape.y));
        ctx.lineWidth = 2;
        ctx.strokeStyle = STROKE;
        break;
      }
    }
  }
  ctx.restore();
}

/** 클라이언트가 보낸 도형의 형태를 검증한다. */
export function isValidShape(value: unknown): value is Shape {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  const finite = (...keys: string[]) =>
    keys.every((k) => Number.isFinite(s[k]));
  switch (s.type) {
    case "rect":
    case "line":
      return finite("x0", "y0", "x1", "y1");
    case "freehand":
      return (
        Array.isArray(s.points) &&
        s.points.length >= 2 &&
        s.points.length <= 5_000 &&
        s.points.every(
          (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
        )
      );
    case "text":
      return (
        finite("x", "y") &&
        typeof s.text === "string" &&
        s.text.trim().length > 0 &&
        s.text.length <= 200
      );
    default:
      return false;
  }
}

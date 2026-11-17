import { describe, expect, it } from "vitest";
import { drawLines } from "./line";
import { DEFAULT_OPTIONS } from "./options";
import { renderScatter, type ScatterInput } from "./scatter";

// 칸 연결 강조: 범위 밖 점을 '선택 밖 진하기'로 먼저, 범위 안 점을 그 위에 그린다.

type Op =
  | { op: "arc"; x: number; y: number; alpha: number }
  | { op: "stroke"; alpha: number; moves: number; points: number }
  | { op: "text"; text: string };

/** 점(arc)·선(stroke)·글자를 그릴 때의 진하기를 적는 canvas */
function recordingCtx() {
  const ops: Op[] = [];
  const state: Record<string, unknown> = {
    canvas: { width: 400, height: 300 },
    globalAlpha: 1,
  };
  let moves = 0;
  let points = 0;
  const ctx = new Proxy(state, {
    get: (target, key: string) => {
      if (key === "measureText")
        return (text: string) => ({ width: text.length * 6 });
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      if (key === "arc")
        return (x: number, y: number) =>
          ops.push({ op: "arc", x, y, alpha: target.globalAlpha as number });
      if (key === "beginPath")
        return () => {
          moves = 0;
          points = 0;
        };
      if (key === "moveTo")
        return () => {
          moves++;
          points++;
        };
      if (key === "lineTo")
        return () => {
          points++;
        };
      if (key === "stroke")
        return () =>
          ops.push({
            op: "stroke",
            alpha: target.globalAlpha as number,
            moves,
            points,
          });
      if (key === "fillText")
        return (text: string) => ops.push({ op: "text", text });
      if (key in target) return target[key];
      return () => {};
    },
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
  return { ctx, ops };
}

const DIM = DEFAULT_OPTIONS.shape.dimOpacity;

const input = (over: Partial<ScatterInput> = {}): ScatterInput => ({
  width: 400,
  height: 300,
  title: "전체",
  xKind: "number",
  xs: Float64Array.from([1, 2, 3, 4]),
  ys: Float64Array.from([1, 2, 3, 4]),
  ids: Float64Array.from([10, 20, 30, 40]),
  color: "#2a78d6",
  shapes: [],
  ...over,
});

describe("scatter 연결 강조", () => {
  it("범위 밖 점은 선택 밖 진하기로 먼저, 범위 안 점은 그 위에 진하게 그린다", () => {
    const { ctx, ops } = recordingCtx();
    renderScatter(
      ctx,
      input({ linked: Uint8Array.from([1, 0, 1, 0]) }),
      () => {},
    );
    const arcs = ops.filter((o) => o.op === "arc");
    expect(arcs.map((a) => a.alpha)).toEqual([DIM, DIM, 1, 1]);
  });

  it("강조가 없으면 모두 한 번에 진하게 그린다", () => {
    const { ctx, ops } = recordingCtx();
    renderScatter(ctx, input(), () => {});
    const arcs = ops.filter((o) => o.op === "arc");
    expect(arcs.map((a) => a.alpha)).toEqual([1, 1, 1, 1]);
  });

  it("지운 점·식 적용 뒤에도 강조 표시가 같은 행을 따라간다", () => {
    const { ctx, ops } = recordingCtx();
    renderScatter(
      ctx,
      input({
        linked: Uint8Array.from([1, 0, 1, 0]),
        // 점 2(x=2)를 지운다 → 남는 점 1·3(범위 안), 4(범위 밖)
        deletions: [{ type: "rect", x0: 1.5, y0: 1.5, x1: 2.5, y1: 2.5 }],
      }),
      () => {},
    );
    const arcs = ops.filter((o) => o.op === "arc");
    expect(arcs.map((a) => a.alpha)).toEqual([DIM, 1, 1]);
  });

  it("metadata는 같은 픽셀 칸이면 범위 안 점을 남긴다", () => {
    const { ctx } = recordingCtx();
    // 행 0(범위 밖)과 행 1(범위 안)이 같은 자리다. 0·10은 축 끝(그림 영역 경계 밖으로 빠진다).
    const meta = renderScatter(
      ctx,
      input({
        xs: Float64Array.from([2, 2, 5, 0, 10]),
        ys: Float64Array.from([2, 2, 5, 0, 10]),
        ids: Float64Array.from([10, 20, 30, 1, 2]),
        linked: Uint8Array.from([0, 1, 0, 0, 0]),
      }),
      () => {},
    );
    expect(meta.points.id).toContain(20);
    expect(meta.points.id).toContain(30);
    expect(meta.points.id).not.toContain(10);
  });

  it("제목 줄 요약 맨 앞에 연결 범위 글자를 적는다", () => {
    const { ctx, ops } = recordingCtx();
    renderScatter(ctx, input({ note: "연결 강조 2행" }), () => {});
    const texts = ops.flatMap((o) => (o.op === "text" ? [o.text] : []));
    expect(texts).toContain("연결 강조 2행 · 4 pts");
  });
});

describe("line 연결 강조", () => {
  const sx = Float32Array.from([10, 20, 30, 40, 50]);
  const sy = Float32Array.from([10, 20, 30, 40, 50]);
  const series = [Int32Array.from([0, 1, 2, 3, 4])];

  it("계열 전체를 흐리게 긋고, 범위 안에서 이어지는 구간만 진하게 다시 긋는다", () => {
    const { ctx, ops } = recordingCtx();
    drawLines(ctx, {
      sx,
      sy,
      series,
      colors: ["#2a78d6"],
      plot: { left: 0, width: 100 },
      compact: true,
      emphasis: { keep: Uint8Array.from([1, 1, 0, 1, 1]), dim: DIM },
    });
    const strokes = ops.filter((o) => o.op === "stroke");
    expect(strokes).toEqual([
      // 흐린 선: 점 5개를 한 구간으로
      { op: "stroke", alpha: DIM, moves: 1, points: 5 },
      // 진한 선: 범위 밖 점(2)에서 끊어 [0, 1]·[3, 4] 두 구간
      { op: "stroke", alpha: 1, moves: 2, points: 4 },
    ]);
  });

  it("강조가 없으면 한 번만 긋는다", () => {
    const { ctx, ops } = recordingCtx();
    drawLines(ctx, {
      sx,
      sy,
      series,
      colors: ["#2a78d6"],
      plot: { left: 0, width: 100 },
      compact: true,
    });
    expect(ops.filter((o) => o.op === "stroke")).toEqual([
      { op: "stroke", alpha: 1, moves: 1, points: 5 },
    ]);
  });
});

// 브라우저 벤치 Worker. 실제 렌더 Worker처럼 OffscreenCanvas에 renderScatter를 돌려
// 단계별 시간(준비 → aggregate → render → PNG 인코딩)을 재고, 같은 데이터에서 커널 시간도 잰다.
// 메인 스레드를 비우는 효과를 보려고 커널 하나를 메시지로 받아 돌려주는 일도 한다.

import { points } from "../../server/compute/fixtures";
import { argsortCompare, argsortRadix } from "../../server/compute/kernels";
import { renderScatter } from "../../server/render/scatter";
import { applyTheme } from "../../server/render/theme";
import { median } from "./cases";

type RenderJob = {
  type: "render";
  sizes: number[];
  rounds: number;
  pixelRatio: number;
};
type SortJob = { type: "sort"; xs: Float64Array; idx: Int32Array };

const WIDTH = 800;
const HEIGHT = 450;

async function renderOnce(
  n: number,
  chartType: "scatter" | "line",
  pixelRatio: number,
) {
  const p = points(n, 42);
  const canvas = new OffscreenCanvas(WIDTH * pixelRatio, HEIGHT * pixelRatio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.scale(pixelRatio, pixelRatio);
  applyTheme(undefined);
  const marks: Partial<Record<string, number>> = {};
  const t0 = performance.now();
  renderScatter(
    ctx,
    {
      chartType,
      width: WIDTH,
      height: HEIGHT,
      title: "bench",
      xKind: "time",
      xs: p.xs,
      ys: p.ys,
      ids: Float64Array.from(p.idx),
      color: "#3b82f6",
      shapes: [],
    },
    (stage) => {
      marks[stage] ??= performance.now();
    },
  );
  const t1 = performance.now();
  await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer();
  const t2 = performance.now();
  // aggregate 첫 알림 = 축·틀 준비 끝(점 루프 시작), render 첫 알림 = 점 루프 끝(그리기 시작).
  const a = marks.aggregate ?? t0;
  const r = marks.render ?? a;
  return {
    total: t2 - t0,
    draw: t1 - t0,
    prepare: a - t0,
    aggregate: r - a,
    paint: t1 - r,
    encode: t2 - t1,
  };
}

async function renderBench({ sizes, rounds, pixelRatio }: RenderJob) {
  const out: Record<string, unknown>[] = [];
  for (const chartType of ["scatter", "line"] as const) {
    for (const n of sizes) {
      await renderOnce(n, chartType, pixelRatio); // 워밍업
      const runs: Awaited<ReturnType<typeof renderOnce>>[] = [];
      for (let k = 0; k < rounds; k++)
        runs.push(await renderOnce(n, chartType, pixelRatio));
      const pick = (key: keyof (typeof runs)[number]) =>
        median(runs.map((r) => r[key]));
      // 같은 데이터에서 정렬 커널(line의 seriesOrder 안 정렬)만
      const p = points(n, 42);
      const sortRuns: number[] = [];
      for (let k = 0; k < rounds; k++) {
        const idx = p.idx.slice();
        const t = performance.now();
        argsortCompare(p.xs, idx);
        sortRuns.push(performance.now() - t);
      }
      out.push({
        chartType,
        n,
        total: pick("total"),
        prepare: pick("prepare"),
        aggregate: pick("aggregate"),
        paint: pick("paint"),
        encode: pick("encode"),
        sort: median(sortRuns),
      });
    }
  }
  return out;
}

self.onmessage = async (e: MessageEvent<RenderJob | SortJob>) => {
  const job = e.data;
  if (job.type === "render") {
    postMessage({ type: "render", rows: await renderBench(job) });
    return;
  }
  argsortRadix(job.xs, job.idx);
  postMessage({ type: "sorted", idx: job.idx }, { transfer: [job.idx.buffer] });
};

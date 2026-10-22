import type { RenderMethods } from "../protocol";
import { renderCandle } from "../render/candle";
import { renderCategory } from "../render/category";
import { renderFunnel } from "../render/funnel";
import { renderGantt } from "../render/gantt";
import { renderHeatmap } from "../render/heatmap";
import { renderHistogram } from "../render/histogram";
import { renderPie } from "../render/pie";
import { renderRadar } from "../render/radar";
import { renderSankey } from "../render/sankey";
import { type ProgressFn, renderScatter } from "../render/scatter";
import { renderTreemap } from "../render/treemap";
import { renderWaterfall } from "../render/waterfall";
import { serveRpc, transfer, type WorkerScope } from "../rpc";

const workerName = (globalThis as unknown as WorkerScope).name;

const noop = () => {};

/** 캔버스에 그리고 PNG로 바꾼다. 그리는 함수가 돌려준 metadata를 함께 넘긴다. */
async function drawPng<M>(
  size: { width: number; height: number },
  draw: (ctx: OffscreenCanvasRenderingContext2D) => M,
  onEncode: () => void = noop,
) {
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const meta = draw(ctx);
  onEncode();
  const png = await (
    await canvas.convertToBlob({ type: "image/png" })
  ).arrayBuffer();
  return { png, meta };
}

type Size = { width: number; height: number };

/**
 * 렌더러 하나로 PNG와 (요청하면) 같은 입력의 섬네일을 그린다. 아래 차트별 메서드와 같은 순서를 묶어 둔 것이다.
 * 진행률은 렌더러 단계(aggregate → render) 다음에 encode를 알린다.
 */
async function renderPair<I extends Size & { compact?: boolean }, M>(
  render: (
    ctx: OffscreenCanvasRenderingContext2D,
    input: I,
    progress: ProgressFn,
  ) => M,
  { thumbnail, ...rest }: I & { thumbnail?: Size },
  progress: (p: {
    stage: Parameters<ProgressFn>[0] | "encode";
    ratio: number;
  }) => void,
) {
  const started = performance.now();
  const input = rest as unknown as I;
  const { png, meta } = await drawPng(
    input,
    (ctx) => render(ctx, input, (stage, ratio) => progress({ stage, ratio })),
    () => progress({ stage: "encode", ratio: 0 }),
  );
  const thumbInput = thumbnail && { ...input, ...thumbnail, compact: true };
  const thumb =
    thumbInput &&
    (await drawPng(thumbInput, (ctx) => render(ctx, thumbInput, noop))).png;
  progress({ stage: "encode", ratio: 1 });
  return transfer(
    { png, thumb, meta, worker: workerName, ms: performance.now() - started },
    thumb ? [png, thumb] : [png],
  );
}

serveRpc<RenderMethods>({
  async renderTest({ width, height, label, points }) {
    const started = performance.now();
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const pad = 32;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + ((height - pad * 2) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
    }

    // 렌더 부하를 흉내 내는 임의의 점. 실제 차트 렌더러는 이후 단계에서 만든다.
    ctx.fillStyle = "rgba(37, 99, 235, 0.35)";
    for (let i = 0; i < points; i++) {
      const t = Math.random();
      const x = pad + t * (width - pad * 2);
      const y =
        height / 2 +
        Math.sin(t * Math.PI * 4) * (height / 5) +
        (Math.random() - 0.5) * (height / 4);
      ctx.fillRect(x, y, 2, 2);
    }

    ctx.fillStyle = "#111827";
    ctx.font = "600 14px sans-serif";
    ctx.fillText(label, pad, 20);
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px sans-serif";
    ctx.fillText(
      `${workerName} · ${points.toLocaleString()} pts`,
      pad,
      height - 10,
    );

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const png = await blob.arrayBuffer();
    return transfer(
      { png, worker: workerName, ms: performance.now() - started },
      [png],
    );
  },

  async renderScatter({ thumbnail, ...input }, { progress }) {
    const started = performance.now();
    const { png, meta } = await drawPng(
      input,
      (ctx) =>
        renderScatter(ctx, input, (stage, ratio) => progress({ stage, ratio })),
      () => progress({ stage: "encode", ratio: 0 }),
    );
    const thumbInput = thumbnail && { ...input, ...thumbnail, compact: true };
    const thumb =
      thumbInput &&
      (await drawPng(thumbInput, (ctx) => renderScatter(ctx, thumbInput, noop)))
        .png;
    progress({ stage: "encode", ratio: 1 });
    return transfer(
      { png, thumb, meta, worker: workerName, ms: performance.now() - started },
      thumb ? [png, thumb] : [png],
    );
  },

  async renderCategory({ thumbnail, ...input }, { progress }) {
    const started = performance.now();
    const { png, meta } = await drawPng(
      input,
      (ctx) =>
        renderCategory(ctx, input, (stage, ratio) =>
          progress({ stage, ratio }),
        ),
      () => progress({ stage: "encode", ratio: 0 }),
    );
    const thumbInput = thumbnail && { ...input, ...thumbnail, compact: true };
    const thumb =
      thumbInput &&
      (
        await drawPng(thumbInput, (ctx) =>
          renderCategory(ctx, thumbInput, noop),
        )
      ).png;
    progress({ stage: "encode", ratio: 1 });
    return transfer(
      { png, thumb, meta, worker: workerName, ms: performance.now() - started },
      thumb ? [png, thumb] : [png],
    );
  },

  async renderSankey({ thumbnail, ...input }, { progress }) {
    const started = performance.now();
    const { png, meta } = await drawPng(
      input,
      (ctx) =>
        renderSankey(ctx, input, (stage, ratio) => progress({ stage, ratio })),
      () => progress({ stage: "encode", ratio: 0 }),
    );
    const thumbInput = thumbnail && { ...input, ...thumbnail, compact: true };
    const thumb =
      thumbInput &&
      (await drawPng(thumbInput, (ctx) => renderSankey(ctx, thumbInput, noop)))
        .png;
    progress({ stage: "encode", ratio: 1 });
    return transfer(
      { png, thumb, meta, worker: workerName, ms: performance.now() - started },
      thumb ? [png, thumb] : [png],
    );
  },

  async renderHeatmap({ thumbnail, ...input }, { progress }) {
    const started = performance.now();
    const { png, meta } = await drawPng(
      input,
      (ctx) =>
        renderHeatmap(ctx, input, (stage, ratio) => progress({ stage, ratio })),
      () => progress({ stage: "encode", ratio: 0 }),
    );
    const thumbInput = thumbnail && { ...input, ...thumbnail, compact: true };
    const thumb =
      thumbInput &&
      (await drawPng(thumbInput, (ctx) => renderHeatmap(ctx, thumbInput, noop)))
        .png;
    progress({ stage: "encode", ratio: 1 });
    return transfer(
      { png, thumb, meta, worker: workerName, ms: performance.now() - started },
      thumb ? [png, thumb] : [png],
    );
  },

  async renderTreemap({ thumbnail, ...input }, { progress }) {
    const started = performance.now();
    const { png, meta } = await drawPng(
      input,
      (ctx) =>
        renderTreemap(ctx, input, (stage, ratio) => progress({ stage, ratio })),
      () => progress({ stage: "encode", ratio: 0 }),
    );
    const thumbInput = thumbnail && { ...input, ...thumbnail, compact: true };
    const thumb =
      thumbInput &&
      (await drawPng(thumbInput, (ctx) => renderTreemap(ctx, thumbInput, noop)))
        .png;
    progress({ stage: "encode", ratio: 1 });
    return transfer(
      { png, thumb, meta, worker: workerName, ms: performance.now() - started },
      thumb ? [png, thumb] : [png],
    );
  },

  async renderCandle({ thumbnail, ...input }, { progress }) {
    const started = performance.now();
    const { png, meta } = await drawPng(
      input,
      (ctx) =>
        renderCandle(ctx, input, (stage, ratio) => progress({ stage, ratio })),
      () => progress({ stage: "encode", ratio: 0 }),
    );
    const thumbInput = thumbnail && { ...input, ...thumbnail, compact: true };
    const thumb =
      thumbInput &&
      (await drawPng(thumbInput, (ctx) => renderCandle(ctx, thumbInput, noop)))
        .png;
    progress({ stage: "encode", ratio: 1 });
    return transfer(
      { png, thumb, meta, worker: workerName, ms: performance.now() - started },
      thumb ? [png, thumb] : [png],
    );
  },

  async renderGantt({ thumbnail, ...input }, { progress }) {
    const started = performance.now();
    const { png, meta } = await drawPng(
      input,
      (ctx) =>
        renderGantt(ctx, input, (stage, ratio) => progress({ stage, ratio })),
      () => progress({ stage: "encode", ratio: 0 }),
    );
    const thumbInput = thumbnail && { ...input, ...thumbnail, compact: true };
    const thumb =
      thumbInput &&
      (await drawPng(thumbInput, (ctx) => renderGantt(ctx, thumbInput, noop)))
        .png;
    progress({ stage: "encode", ratio: 1 });
    return transfer(
      { png, thumb, meta, worker: workerName, ms: performance.now() - started },
      thumb ? [png, thumb] : [png],
    );
  },

  async renderPie({ thumbnail, ...input }, { progress }) {
    const started = performance.now();
    const { png, meta } = await drawPng(
      input,
      (ctx) =>
        renderPie(ctx, input, (stage, ratio) => progress({ stage, ratio })),
      () => progress({ stage: "encode", ratio: 0 }),
    );
    const thumbInput = thumbnail && { ...input, ...thumbnail, compact: true };
    const thumb =
      thumbInput &&
      (await drawPng(thumbInput, (ctx) => renderPie(ctx, thumbInput, noop)))
        .png;
    progress({ stage: "encode", ratio: 1 });
    return transfer(
      { png, thumb, meta, worker: workerName, ms: performance.now() - started },
      thumb ? [png, thumb] : [png],
    );
  },

  async renderRadar({ thumbnail, ...input }, { progress }) {
    const started = performance.now();
    const { png, meta } = await drawPng(
      input,
      (ctx) =>
        renderRadar(ctx, input, (stage, ratio) => progress({ stage, ratio })),
      () => progress({ stage: "encode", ratio: 0 }),
    );
    const thumbInput = thumbnail && { ...input, ...thumbnail, compact: true };
    const thumb =
      thumbInput &&
      (await drawPng(thumbInput, (ctx) => renderRadar(ctx, thumbInput, noop)))
        .png;
    progress({ stage: "encode", ratio: 1 });
    return transfer(
      { png, thumb, meta, worker: workerName, ms: performance.now() - started },
      thumb ? [png, thumb] : [png],
    );
  },

  renderHistogram(params, { progress }) {
    return renderPair(renderHistogram, params, progress);
  },

  renderWaterfall(params, { progress }) {
    return renderPair(renderWaterfall, params, progress);
  },

  renderFunnel(params, { progress }) {
    return renderPair(renderFunnel, params, progress);
  },
});

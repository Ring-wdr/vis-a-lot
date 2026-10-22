import type { RenderMethods } from "../protocol";
import { renderCategory } from "../render/category";
import { renderHeatmap } from "../render/heatmap";
import { renderSankey } from "../render/sankey";
import { renderScatter } from "../render/scatter";
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
});

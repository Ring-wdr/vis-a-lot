import { HttpResponse, http } from "msw";
import { matchPng, putPng } from "../png-store";
import { getRuntime } from "../runtime";

export type HealthResponse = {
  db: { version: string; bootCount: number; bootMs: number };
  renderWorkers: number;
};

export type DebugRenderRequest = {
  chartId: string;
  itemKey: string;
  width: number;
  height: number;
  points: number;
};

export type DebugRenderResponse = {
  url: string;
  width: number;
  height: number;
  worker: string;
  renderMs: number;
};

let pngVersion = 0;

export const handlers = [
  http.get("/api/health", async () => {
    const { db, render } = getRuntime();
    const info = await db.call("ping", undefined);
    return HttpResponse.json<HealthResponse>({
      db: info,
      renderWorkers: render.size,
    });
  }),

  // 1단계 검증용 렌더. 이후 job 모델(`POST /api/charts`)로 대체한다.
  http.post("/api/debug/render", async ({ request }) => {
    const body = (await request.json()) as DebugRenderRequest;
    const { render } = getRuntime();
    const result = await render.call("renderTest", {
      width: body.width,
      height: body.height,
      label: body.itemKey,
      points: body.points,
    });
    const url = `/api/charts/${encodeURIComponent(body.chartId)}/items/${encodeURIComponent(body.itemKey)}/png?v=${++pngVersion}`;
    await putPng(new URL(url, location.origin).href, result.png);
    return HttpResponse.json<DebugRenderResponse>({
      url,
      width: body.width,
      height: body.height,
      worker: result.worker,
      renderMs: result.ms,
    });
  }),

  // `<img src>` 요청도 service worker를 거쳐 여기로 온다.
  http.get("/api/charts/:chartId/items/:itemKey/png", async ({ request }) => {
    const cached = await matchPng(request.url);
    if (!cached) return new HttpResponse(null, { status: 404 });
    return new HttpResponse(await cached.arrayBuffer(), {
      headers: { "content-type": "image/png" },
    });
  }),
];

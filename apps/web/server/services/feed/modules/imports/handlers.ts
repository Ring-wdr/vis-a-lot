// 피드 imports API handler. 같은 DB Worker의 chart 서비스 공유(메타·PNG)를 읽어 차트 게시물 입력으로 바꾼다.

import { getRuntime } from "../../../../runtime";
import { apiError } from "../../../common/http";
import type { FeedApp } from "../../app-type";
import * as routes from "./routes";
import type { ChartShareImport } from "./schemas";

/** 공유 페이지 경로. 화면의 sharePagePath와 같은 모양 (서버는 화면 코드를 import하지 않는다) */
const sharePagePath = (id: string) => `/share?id=${encodeURIComponent(id)}`;

/** 바이트를 base64로. 큰 PNG도 String.fromCharCode 인자 수 한도에 걸리지 않게 나눠 바꾼다 */
export function toBase64(bytes: Uint8Array) {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

export function registerImports(app: FeedApp) {
  return app.openapi(routes.importChartShare, async (c) => {
    const { shareId } = c.req.valid("param");
    const db = getRuntime().db;
    const share = await db.call("shareGet", { id: shareId });
    if (!share) return apiError(c, 404, `모르는 공유입니다: ${shareId}`);
    const png = await db.call("sharePng", { id: shareId });
    if (!png) return apiError(c, 404, `공유 이미지가 없습니다: ${shareId}`);
    const link = sharePagePath(share.id);
    const body: ChartShareImport = {
      shareId: share.id,
      title: share.title,
      thumbnail: `data:image/png;base64,${toBase64(png)}`,
      link,
      payload: {
        source: "vis-a-lot",
        shareId: share.id,
        link,
        chartType: share.spec.chartType,
        dataset: share.dataset,
        item: { key: share.item.key, label: share.item.label },
      },
      createdByName: share.createdByName,
      createdAt: new Date(share.createdAt).toISOString(),
    };
    return c.json(body, 200);
  });
}

// 피드 imports API 정의. 같은 브라우저의 vis-a-lot chart 서비스 공유를 읽어 게시물 입력으로 돌려준다.

import { createRoute, z } from "@hono/zod-openapi";
import { errorResponse, jsonResponse } from "../../../common/http";
import { PathId } from "../common";
import { ChartShareImportSchema } from "./schemas";

export const importChartShare = createRoute({
  method: "get",
  path: "/imports/chart-shares/{shareId}",
  tags: ["imports"],
  summary:
    "vis-a-lot 차트 공유를 차트 게시물 입력으로 (/feed/new?share=…). 공유 PNG는 data URL로",
  request: { params: z.object({ shareId: PathId("shareId") }) },
  responses: {
    200: jsonResponse(ChartShareImportSchema, "게시물 입력"),
    404: errorResponse("모르는 공유"),
  },
});

// 피드 imports API 스키마: vis-a-lot 차트 공유 → 차트 게시물.

import { z } from "@hono/zod-openapi";

export const ChartShareImportSchema = z
  .object({
    shareId: z.string(),
    /** 공유 제목. 게시물 제목 기본값 */
    title: z.string(),
    /** 대표 PNG data URL. 게시물 썸네일 */
    thumbnail: z.string(),
    /** 공유 페이지 경로 (/share?id=…). 게시물에서 차트를 다시 연다 */
    link: z.string(),
    /** 게시물 payload에 그대로 넣는 값: { source: 'vis-a-lot', shareId, link, chartType, dataset, item } */
    payload: z.object({
      source: z.literal("vis-a-lot"),
      shareId: z.string(),
      link: z.string(),
      chartType: z.string(),
      dataset: z.string(),
      item: z.object({ key: z.string(), label: z.string() }),
    }),
    createdByName: z.string(),
    createdAt: z.string(),
  })
  .openapi("ChartShareImport");

export type ChartShareImport = z.infer<typeof ChartShareImportSchema>;

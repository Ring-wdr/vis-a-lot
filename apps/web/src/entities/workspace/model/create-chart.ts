"use client";

import { ApiRequestError, api } from "@/shared/api/api";
import type { CreateChartRequest } from "@/shared/api/types";
import type { WorkspaceStore } from "./workspace-store";

/** 연결 때문에 거절된 draw (모르는 따를 칸 404, 따를 칸이 아직 그려지지 않음 409, 쓸 수 없는 연결 422) */
const LINK_REJECTED = new Set([404, 409, 422]);

/**
 * 이 작업 상태(탭·칸)에 차트를 만든다 (POST /charts). analytics 칸이면 칸 연결을 함께 건다.
 * 연결 때문에 거절되면 연결 없이 다시 보낸다: 그림은 그리고, 범위는 따를 칸이 다 그린 뒤 연결 전파(PUT …/link)가 건다.
 * 쓸 수 없는 연결(422)이면 사유를 칸에 남긴다.
 */
export async function createChartIn(
  store: WorkspaceStore,
  body: CreateChartRequest,
) {
  const drawLink = store.getState().drawLink;
  const link = drawLink?.request(body.spec);
  if (!drawLink || !link) return api.createChart(body);
  try {
    const res = await api.createChart({ ...body, link });
    drawLink.settled(null);
    return res;
  } catch (err) {
    if (!(err instanceof ApiRequestError) || !LINK_REJECTED.has(err.status))
      throw err;
    if (err.status === 422) drawLink.settled(err.message);
    return api.createChart(body);
  }
}

// API gateway: 경로 prefix로 서비스를 고른다. 원본의 MSA 앞단(gateway)과 같은 역할이다.
// MSW는 브라우저의 요청을 이 gateway에 넘기기만 한다.

import { Hono } from "hono";
import { http } from "msw";
import { authApp } from "./services/auth/app";
import { chartApp } from "./services/chart/app";
import type { ApiError } from "./services/common/http";
import { dataApp } from "./services/data/app";
import { SERVICES } from "./services/registry";

const gateway = new Hono()
  .route(SERVICES.auth.basePath, authApp)
  .route(SERVICES.data.basePath, dataApp)
  .route(SERVICES.chart.basePath, chartApp);

gateway.notFound((c) => c.json<ApiError>({ error: "not found" }, 404));
gateway.onError((err, c) => {
  console.error(err);
  return c.json<ApiError>({ error: err.message || "internal error" }, 500);
});

export const handlers = [
  http.all("/api/*", ({ request }) => gateway.fetch(request)),
];

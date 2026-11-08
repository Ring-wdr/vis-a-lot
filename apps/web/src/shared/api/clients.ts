// 서비스별 API client. OAS에서 생성한 paths 타입으로 경로·파라미터·응답이 모두 타입 검사된다.

import createClient from "openapi-fetch";
import type { paths as ChartPaths } from "./generated/chart";
import type { paths as DataPaths } from "./generated/data";
import { currentAccessToken, refreshSession } from "./session";

async function withToken(request: Request) {
  const token = await currentAccessToken();
  if (token) request.headers.set("Authorization", `Bearer ${token}`);
  return request;
}

/**
 * Bearer 토큰을 붙여 보낸다. 401이면 refresh 후 한 번만 다시 보낸다.
 * 다시 보낼 때 body를 또 읽을 수 있도록 보내기 전에 요청을 복제해 둔다.
 */
async function authFetch(input: Request) {
  const retry = input.clone();
  const res = await fetch(await withToken(input));
  if (res.status !== 401) return res;
  if (!(await refreshSession())) return res;
  return fetch(await withToken(retry));
}

export const chartClient = createClient<ChartPaths>({
  baseUrl: "/api/chart",
  fetch: authFetch,
});

export const dataClient = createClient<DataPaths>({
  baseUrl: "/api/data",
  fetch: authFetch,
});

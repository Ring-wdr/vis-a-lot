// chart 서비스 → data 서비스 호출. data 서비스의 OAS에서 생성한 타입으로 요청·응답을 맞춘다.
// 인증은 auth 서비스에서 받은 서비스 토큰(client credentials)으로 한다.

import createClient, { type Middleware } from "openapi-fetch";
import type { ChartFilter } from "../../../data/filters";
import type { paths as AuthPaths } from "../generated/auth";
import type { paths as DataPaths } from "../generated/data";

const CLIENT_ID = "chart-service";
const CLIENT_SECRET = "chart-service-secret";
/** 만료 직전 토큰으로 보내지 않도록 이만큼 일찍 새로 받는다. */
const RENEW_BEFORE_MS = 30_000;

const auth = createClient<AuthPaths>({ baseUrl: "/api/auth" });
const data = createClient<DataPaths>({ baseUrl: "/api/data" });

type Token = { value: string; expiresAt: number };
let token: Promise<Token> | undefined;

async function serviceToken() {
  const current = token && (await token.catch(() => undefined));
  if (!token || !current || current.expiresAt - RENEW_BEFORE_MS < Date.now()) {
    token = auth
      .POST("/token", {
        body: {
          grantType: "client_credentials",
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
        },
      })
      .then(({ data: body, error }) => {
        if (!body)
          throw new Error(`service token: ${error?.error ?? "failed"}`);
        return {
          value: body.accessToken,
          expiresAt: Date.now() + body.expiresIn * 1000,
        };
      });
  }
  return (await token).value;
}

const bearer: Middleware = {
  async onRequest({ request }) {
    request.headers.set("Authorization", `Bearer ${await serviceToken()}`);
    return request;
  },
};
data.use(bearer);

/** data 서비스가 실패로 답한 요청. 부르는 쪽은 status로 이유를 가른다 (404 모르는 데이터셋, 409 준비 전 등). */
export class DataServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function unwrap<T>(
  result: { data?: T; error?: { error: string }; response: Response },
  what: string,
) {
  if (result.data === undefined) {
    throw new DataServiceError(
      result.response.status,
      `data service ${what}: ${result.error?.error ?? "failed"}`,
    );
  }
  return result.data;
}

export const dataService = {
  /** 샘플이 없으면 적재를 시작하고 현재 상태를 돌려준다. 업로드한 데이터셋은 상태만 돌려준다. */
  ensureDataset: async (datasetId: string) =>
    unwrap(
      await data.POST("/datasets/{datasetId}/generate", {
        params: { path: { datasetId } },
      }),
      "generate",
    ),
  splitCount: async (
    datasetId: string,
    cols: string[],
    filters?: ChartFilter[],
  ) =>
    unwrap(
      await data.POST("/datasets/{datasetId}/split-count", {
        params: { path: { datasetId } },
        body: { cols, filters },
      }),
      "split-count",
    ),
  /** 데이터셋 스키마. job이 데이터 준비 뒤 컬럼과 타입을 확인하는 데 쓴다. */
  schema: async (datasetId: string) =>
    unwrap(
      await data.GET("/datasets/{datasetId}/schema", {
        params: { path: { datasetId } },
      }),
      "schema",
    ),
};

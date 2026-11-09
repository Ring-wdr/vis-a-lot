// chart·data 서비스가 auth 서비스의 공개 키(JWKS)로 access token을 검증한다.
// 서비스끼리 비밀 키를 나눠 갖지 않고, auth 서비스만 서명한다.

import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import { apiError, type ServiceEnv } from "./http";

export const ISSUER = "vis-a-lot-auth";
export const AUDIENCE = "vis-a-lot";
export const JWKS_PATH = "/api/auth/.well-known/jwks.json";

/** OAS 문서에 붙는 보안 요구사항 */
export const BEARER = [{ bearer: [] }];

export const SCOPES = [
  "chart:read",
  "chart:write",
  "data:read",
  "data:write",
] as const;
export type Scope = (typeof SCOPES)[number];

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/** 첫 검증 때 JWKS를 받아 오고, 모르는 kid가 오면 jose가 다시 받아 온다. */
function remoteJwks() {
  jwks ??= createRemoteJWKSet(new URL(JWKS_PATH, location.origin));
  return jwks;
}

/**
 * Bearer access token을 검증하고 scope를 확인한다. 통과하면 principal을 context에 남긴다.
 * 만료는 401 + `token expired`로 구분해 화면이 refresh 후 다시 시도할 수 있게 한다.
 */
export function requireAuth(scope: Scope) {
  return createMiddleware<ServiceEnv>(async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      c.header("WWW-Authenticate", 'Bearer realm="vis-a-lot"');
      return apiError(c, 401, "missing bearer token");
    }
    try {
      const { payload } = await jwtVerify(token, remoteJwks(), {
        issuer: ISSUER,
        audience: AUDIENCE,
        typ: "at+jwt",
      });
      const scopes = String(payload.scope ?? "").split(" ");
      if (!scopes.includes(scope)) {
        return apiError(c, 403, `scope ${scope} is required`);
      }
      c.set("principal", {
        sub: String(payload.sub),
        name: String(payload.name ?? payload.sub),
        scopes,
      });
    } catch (err) {
      c.header("WWW-Authenticate", 'Bearer error="invalid_token"');
      return apiError(
        c,
        401,
        err instanceof errors.JWTExpired ? "token expired" : "invalid token",
      );
    }
    await next();
  });
}

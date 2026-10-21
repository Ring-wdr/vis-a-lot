// auth 서비스: 로그인, refresh(rotation), 로그아웃, 서비스 토큰, 공개 키(JWKS).

import { importJWK, jwtVerify, SignJWT } from "jose";
import { AUDIENCE, ISSUER, type Scope } from "../common/auth";
import { apiError, createServiceApp } from "../common/http";
import { ACCOUNTS, findAccount, SERVICE_CLIENTS, toUser } from "./accounts";
import * as routes from "./routes";
import type { User } from "./schemas";
import {
  ALG,
  dropSession,
  getSigningKey,
  saveSession,
  takeSession,
} from "./token-store";

// 세션 만료를 확인할 때는 빌드할 때 NEXT_PUBLIC_ACCESS_TTL_SEC, NEXT_PUBLIC_REFRESH_TTL_SEC로 줄인다.
const ttlFromEnv = (value: string | undefined, fallback: number) =>
  Number(value) > 0 ? Number(value) : fallback;

/** access token 수명. 짧게 두고 refresh로 이어 간다. */
export const ACCESS_TTL_SEC = ttlFromEnv(
  process.env.NEXT_PUBLIC_ACCESS_TTL_SEC,
  5 * 60,
);
/** refresh token 수명. 쓸 때마다 새로 받으므로 이만큼 아무 요청이 없으면 세션이 끝난다. */
const REFRESH_TTL_SEC = ttlFromEnv(
  process.env.NEXT_PUBLIC_REFRESH_TTL_SEC,
  7 * 24 * 60 * 60,
);
const SERVICE_TTL_SEC = 10 * 60;
const REFRESH_AUDIENCE = ISSUER;

async function accessToken(
  sub: string,
  name: string,
  scopes: Scope[],
  ttl: number,
) {
  const { kid, privateKey } = await getSigningKey();
  return new SignJWT({ name, scope: scopes.join(" ") })
    .setProtectedHeader({ alg: ALG, kid, typ: "at+jwt" })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(privateKey);
}

/** refresh token은 세션 id(jti)를 담은 JWT다. 세션이 저장소에 있어야만 쓸 수 있다. */
async function issueTokens(user: User) {
  const { kid, privateKey } = await getSigningKey();
  const jti = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + REFRESH_TTL_SEC;
  await saveSession(jti, { sub: user.id, exp });
  const refreshToken = await new SignJWT({})
    .setProtectedHeader({ alg: ALG, kid, typ: "refresh+jwt" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(REFRESH_AUDIENCE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(privateKey);
  return {
    accessToken: await accessToken(
      user.id,
      user.name,
      user.scopes,
      ACCESS_TTL_SEC,
    ),
    refreshToken,
    tokenType: "Bearer" as const,
    expiresIn: ACCESS_TTL_SEC,
    user,
  };
}

async function verifyRefresh(token: string) {
  const { publicJwk } = await getSigningKey();
  try {
    const { payload } = await jwtVerify(
      token,
      await importJWK(publicJwk, ALG),
      {
        issuer: ISSUER,
        audience: REFRESH_AUDIENCE,
        typ: "refresh+jwt",
      },
    );
    return payload.jti ? payload : undefined;
  } catch {
    return undefined;
  }
}

export const authApp = createServiceApp()
  .openapi(routes.login, async (c) => {
    const { username, password } = c.req.valid("json");
    const account = findAccount(username, password);
    if (!account) return apiError(c, 401, "아이디 또는 비밀번호가 틀렸습니다.");
    return c.json(await issueTokens(toUser(account)), 200);
  })
  .openapi(routes.refresh, async (c) => {
    const payload = await verifyRefresh(c.req.valid("json").refreshToken);
    // 한 번 쓴 refresh token은 세션이 지워져 다시 쓸 수 없다 (rotation).
    const session = payload?.jti ? await takeSession(payload.jti) : undefined;
    const account = session && ACCOUNTS.find((a) => a.id === session.sub);
    if (!account)
      return apiError(c, 401, "세션이 만료되었습니다. 다시 로그인해 주세요.");
    return c.json(await issueTokens(toUser(account)), 200);
  })
  .openapi(routes.logout, async (c) => {
    const payload = await verifyRefresh(c.req.valid("json").refreshToken);
    if (payload?.jti) await dropSession(payload.jti);
    return c.body(null, 204);
  })
  .openapi(routes.me, (c) => {
    const { sub } = c.get("principal");
    const account = ACCOUNTS.find((a) => a.id === sub);
    if (!account) return apiError(c, 401, "invalid token");
    return c.json(toUser(account), 200);
  })
  .openapi(routes.serviceToken, async (c) => {
    const { clientId, clientSecret } = c.req.valid("json");
    const client = SERVICE_CLIENTS.find(
      (s) => s.clientId === clientId && s.clientSecret === clientSecret,
    );
    if (!client) return apiError(c, 401, "unknown client");
    return c.json(
      {
        accessToken: await accessToken(
          `service:${clientId}`,
          clientId,
          client.scopes,
          SERVICE_TTL_SEC,
        ),
        tokenType: "Bearer" as const,
        expiresIn: SERVICE_TTL_SEC,
      },
      200,
    );
  })
  .openapi(routes.jwks, async (c) => {
    const { publicJwk } = await getSigningKey();
    return c.json({ keys: [publicJwk] }, 200);
  })
  .openapi(routes.health, async (c) => {
    const { kid } = await getSigningKey();
    return c.json({ service: "auth" as const, keyId: kid }, 200);
  });

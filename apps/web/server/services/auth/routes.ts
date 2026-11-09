// auth 서비스 API 정의. handler 없이 계약만 있어 OAS 생성기가 그대로 읽는다.

import { createRoute } from "@hono/zod-openapi";
import { BEARER, requireAuth } from "../common/auth";
import { errorResponse, jsonBody, jsonResponse } from "../common/http";
import {
  AuthHealthSchema,
  JwksSchema,
  LoginRequestSchema,
  RefreshRequestSchema,
  ServiceTokenRequestSchema,
  ServiceTokenResponseSchema,
  TokenResponseSchema,
  UserSchema,
} from "./schemas";

const tags = ["auth"];

export const login = createRoute({
  method: "post",
  path: "/login",
  tags,
  summary: "아이디·비밀번호로 로그인",
  request: { body: jsonBody(LoginRequestSchema) },
  responses: {
    200: jsonResponse(TokenResponseSchema, "access / refresh token"),
    400: errorResponse("요청 형식 오류"),
    401: errorResponse("아이디 또는 비밀번호가 틀림"),
  },
});

export const refresh = createRoute({
  method: "post",
  path: "/refresh",
  tags,
  summary:
    "refresh token으로 토큰 다시 받기 (rotation: 쓴 refresh token은 폐기)",
  request: { body: jsonBody(RefreshRequestSchema) },
  responses: {
    200: jsonResponse(TokenResponseSchema, "새 access / refresh token"),
    400: errorResponse("요청 형식 오류"),
    401: errorResponse("만료되었거나 폐기된 refresh token"),
  },
});

export const logout = createRoute({
  method: "post",
  path: "/logout",
  tags,
  summary: "refresh token 폐기",
  request: { body: jsonBody(RefreshRequestSchema) },
  responses: {
    204: { description: "폐기됨 (이미 없어도 204)" },
    400: errorResponse("요청 형식 오류"),
  },
});

export const me = createRoute({
  method: "get",
  path: "/me",
  tags,
  summary: "현재 사용자",
  security: BEARER,
  middleware: requireAuth("chart:read"),
  responses: {
    200: jsonResponse(UserSchema, "사용자"),
    401: errorResponse("토큰 없음, 만료, 위조"),
    403: errorResponse("scope 부족"),
  },
});

export const serviceToken = createRoute({
  method: "post",
  path: "/token",
  tags,
  summary: "서비스 간 호출용 토큰 (client credentials)",
  request: { body: jsonBody(ServiceTokenRequestSchema) },
  responses: {
    200: jsonResponse(ServiceTokenResponseSchema, "서비스 access token"),
    400: errorResponse("요청 형식 오류"),
    401: errorResponse("모르는 client"),
  },
});

export const jwks = createRoute({
  method: "get",
  path: "/.well-known/jwks.json",
  tags,
  summary: "access token 검증용 공개 키",
  responses: { 200: jsonResponse(JwksSchema, "JWK Set") },
});

export const health = createRoute({
  method: "get",
  path: "/health",
  tags,
  responses: { 200: jsonResponse(AuthHealthSchema, "상태") },
});

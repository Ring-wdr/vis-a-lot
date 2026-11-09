import { z } from "@hono/zod-openapi";
import { SCOPES } from "../common/auth";

export const ScopeSchema = z.enum(SCOPES).openapi("Scope");

export const UserSchema = z
  .object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    scopes: z.array(ScopeSchema),
  })
  .openapi("User");

export const LoginRequestSchema = z
  .object({
    username: z.string().min(1).openapi({ example: "demo" }),
    password: z.string().min(1).openapi({ example: "demo1234" }),
  })
  .openapi("LoginRequest");

export const TokenResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    tokenType: z.literal("Bearer"),
    /** access token 수명(초) */
    expiresIn: z.number().int(),
    user: UserSchema,
  })
  .openapi("TokenResponse");

export const RefreshRequestSchema = z
  .object({ refreshToken: z.string().min(1) })
  .openapi("RefreshRequest");

export const ServiceTokenRequestSchema = z
  .object({
    grantType: z.literal("client_credentials"),
    clientId: z.string(),
    clientSecret: z.string(),
  })
  .openapi("ServiceTokenRequest");

export const ServiceTokenResponseSchema = z
  .object({
    accessToken: z.string(),
    tokenType: z.literal("Bearer"),
    expiresIn: z.number().int(),
  })
  .openapi("ServiceTokenResponse");

export const JwksSchema = z
  .object({ keys: z.array(z.record(z.string(), z.unknown())) })
  .openapi("Jwks");

export const AuthHealthSchema = z
  .object({ service: z.literal("auth"), keyId: z.string() })
  .openapi("AuthHealth");

export type User = z.infer<typeof UserSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

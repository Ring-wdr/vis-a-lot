// 모든 서비스가 같은 모양으로 에러를 돌려주고, 같은 방식으로 요청을 검증한다.

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "unknown chart" }) })
  .openapi("ApiError");

export type ApiError = z.infer<typeof ErrorSchema>;

export function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: ErrorSchema } },
  } as const;
}

export function jsonResponse<T extends z.ZodType>(
  schema: T,
  description: string,
) {
  return {
    description,
    content: { "application/json": { schema } },
  } as const;
}

export function jsonBody<T extends z.ZodType>(schema: T) {
  return {
    required: true,
    content: { "application/json": { schema } },
  } as const;
}

export function apiError<S extends ContentfulStatusCode>(
  c: Context,
  status: S,
  error: string,
) {
  return c.json({ error } satisfies ApiError, status);
}

export type ServiceEnv = {
  Variables: {
    /** 검증한 access token의 주체. 사용자면 user id, 서비스면 `service:<이름>` */
    principal: Principal;
  };
};

export type Principal = { sub: string; name: string; scopes: string[] };

/**
 * 서비스 하나 = OpenAPIHono 앱 하나. 요청 검증에 실패하면 zod 이슈를 한 줄로 요약해 400으로 돌려준다.
 * 원본의 Spring 서비스 + springdoc처럼 handler에 붙은 스키마가 곧 OAS 문서가 된다.
 */
export function createServiceApp() {
  const app = new OpenAPIHono<ServiceEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0];
        const where = issue?.path.join(".") || result.target;
        return apiError(c, 400, `${where}: ${issue?.message ?? "invalid"}`);
      }
    },
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "bearer", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });
  return app;
}

export type ServiceApp = ReturnType<typeof createServiceApp>;

export const SERVICE_DOC_VERSION = "1.0.0";

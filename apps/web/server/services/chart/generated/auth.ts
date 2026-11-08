// 자동 생성 파일. 직접 고치지 말고 `pnpm gen:api`로 다시 만든다.

export type paths = {
  "/health": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 상태 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["AuthHealth"];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/.well-known/jwks.json": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** access token 검증용 공개 키 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description JWK Set */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["Jwks"];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/login": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 아이디·비밀번호로 로그인 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["LoginRequest"];
        };
      };
      responses: {
        /** @description access / refresh token */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["TokenResponse"];
          };
        };
        /** @description 요청 형식 오류 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 아이디 또는 비밀번호가 틀림 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/logout": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** refresh token 폐기 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["RefreshRequest"];
        };
      };
      responses: {
        /** @description 폐기됨 (이미 없어도 204) */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description 요청 형식 오류 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/me": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 현재 사용자 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 사용자 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["User"];
          };
        };
        /** @description 토큰 없음, 만료, 위조 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description scope 부족 */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/refresh": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** refresh token으로 토큰 다시 받기 (rotation: 쓴 refresh token은 폐기) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["RefreshRequest"];
        };
      };
      responses: {
        /** @description 새 access / refresh token */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["TokenResponse"];
          };
        };
        /** @description 요청 형식 오류 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 만료되었거나 폐기된 refresh token */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/token": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 서비스 간 호출용 토큰 (client credentials) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["ServiceTokenRequest"];
        };
      };
      responses: {
        /** @description 서비스 access token */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ServiceTokenResponse"];
          };
        };
        /** @description 요청 형식 오류 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 client */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
};
export type webhooks = Record<string, never>;
export type components = {
  schemas: {
    AuthHealth: {
      /** @enum {string} */
      service: "auth";
      keyId: string;
    };
    Jwks: {
      keys: {
        [key: string]: unknown;
      }[];
    };
    TokenResponse: {
      accessToken: string;
      refreshToken: string;
      /** @enum {string} */
      tokenType: "Bearer";
      expiresIn: number;
      user: components["schemas"]["User"];
    };
    User: {
      id: string;
      username: string;
      name: string;
      scopes: components["schemas"]["Scope"][];
    };
    /** @enum {string} */
    Scope: "chart:read" | "chart:write" | "data:read" | "data:write";
    ApiError: {
      /** @example unknown chart */
      error: string;
    };
    LoginRequest: {
      /** @example demo */
      username: string;
      /** @example demo1234 */
      password: string;
    };
    RefreshRequest: {
      refreshToken: string;
    };
    ServiceTokenResponse: {
      accessToken: string;
      /** @enum {string} */
      tokenType: "Bearer";
      expiresIn: number;
    };
    ServiceTokenRequest: {
      /** @enum {string} */
      grantType: "client_credentials";
      clientId: string;
      clientSecret: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
};
export type $defs = Record<string, never>;
export type operations = Record<string, never>;

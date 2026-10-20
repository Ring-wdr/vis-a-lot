// 자동 생성 파일. 직접 고치지 말고 `pnpm gen:api`로 다시 만든다.

export type paths = {
  "/datasets/{datasetId}/columns": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 컬럼 타입과 고유값 수 */
    get: {
      parameters: {
        query: {
          rows: 100000 | 500000 | 1000000;
        };
        header?: never;
        path: {
          datasetId: components["schemas"]["DatasetId"];
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 컬럼 목록 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ColumnsResponse"];
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
        /** @description 모르는 데이터셋 */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 데이터셋이 아직 준비되지 않음 */
        409: {
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
  "/datasets/{datasetId}/generate": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 데이터 적재(등록). 이미 있거나 만드는 중이면 현재 상태만 돌려준다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          datasetId: components["schemas"]["DatasetId"];
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["GenerateDatasetRequest"];
        };
      };
      responses: {
        /** @description 현재 상태 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["DatasetStatus"];
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
        /** @description 모르는 데이터셋 */
        404: {
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
            "application/json": components["schemas"]["DataHealth"];
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
  "/datasets/{datasetId}/legend-values": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** legend 컬럼의 전체 값 목록 */
    get: {
      parameters: {
        query: {
          rows: 100000 | 500000 | 1000000;
          column: components["schemas"]["LegendColumn"];
        };
        header?: never;
        path: {
          datasetId: components["schemas"]["DatasetId"];
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description legend 값 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["LegendValuesResponse"];
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
        /** @description 모르는 데이터셋 */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 데이터셋이 아직 준비되지 않음 */
        409: {
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
  "/datasets/{datasetId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 행 수별 적재 상태 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          datasetId: components["schemas"]["DatasetId"];
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 행 수별 상태 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["DatasetListResponse"];
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
        /** @description 모르는 데이터셋 */
        404: {
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
  "/datasets/{datasetId}/split-count": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** split 조합 개수 (최대 개수 초과 검사) */
    get: {
      parameters: {
        query: {
          rows: 100000 | 500000 | 1000000;
          /** @description 쉼표로 구분한 split 컬럼 */
          cols?: string;
        };
        header?: never;
        path: {
          datasetId: components["schemas"]["DatasetId"];
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 조합 개수 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["SplitCountResponse"];
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
        /** @description 모르는 데이터셋 */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 데이터셋이 아직 준비되지 않음 */
        409: {
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
};
export type webhooks = Record<string, never>;
export type components = {
  schemas: {
    ColumnsResponse: {
      rows: components["schemas"]["RowSize"];
      columns: components["schemas"]["ColumnInfo"][];
    };
    RowSize: 100000 | 500000 | 1000000;
    ColumnInfo: {
      name: string;
      type: components["schemas"]["ColumnType"];
      label: string;
      distinct: number;
    };
    /** @enum {string} */
    ColumnType: "time" | "string" | "number";
    ApiError: {
      /** @example unknown chart */
      error: string;
    };
    /** @enum {string} */
    DatasetId: "iot";
    DatasetStatus: {
      rows: components["schemas"]["RowSize"];
      /** @enum {string} */
      state: "missing" | "generating" | "ready";
      /** @enum {string} */
      phase?: "copy" | "analyze";
      done: number;
      total: number;
      generateMs?: number;
    };
    GenerateDatasetRequest: {
      rows: components["schemas"]["RowSize"];
    };
    DataHealth: {
      /** @enum {string} */
      service: "data";
      db: {
        version: string;
        bootCount: number;
        bootMs: number;
      };
    };
    LegendValuesResponse: {
      column: components["schemas"]["LegendColumn"];
      values: string[];
    };
    /** @enum {string} */
    LegendColumn: "factory" | "line" | "sensor_type" | "shift" | "status";
    DatasetListResponse: {
      datasets: components["schemas"]["DatasetStatus"][];
    };
    SplitCountResponse: {
      count: number;
      exact: boolean;
      limit: number;
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

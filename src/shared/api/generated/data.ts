// 자동 생성 파일. 직접 고치지 말고 `pnpm gen:api`로 다시 만든다.

export type paths = {
  "/datasets/{datasetId}/columns/{column}/summary": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 필터용 컬럼 요약: 숫자·시계열은 범위와 null 수, 범주는 값별 행 수 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          datasetId: components["schemas"]["DatasetId"];
          column: components["schemas"]["ColumnName"];
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 컬럼 요약 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ColumnSummary"];
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
    /** 데이터셋 하나의 적재 상태 */
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
        /** @description 상태 */
        200: {
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
    put?: never;
    post?: never;
    /** 업로드한 데이터셋 삭제 */
    delete: {
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
        /** @description 삭제됨 */
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
        /** @description 적재 중이라 지울 수 없음 */
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
    options?: never;
    head?: never;
    /** 업로드한 데이터셋의 이름·전처리 옵션 변경. 옵션을 바꾸면 원본으로 다시 검사·적재한다 */
    patch: {
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
          "application/json": components["schemas"]["EditDatasetRequest"];
        };
      };
      responses: {
        /** @description 바뀐 상태 */
        200: {
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
        /** @description CSV 검사에서 거절 (스키마 불일치 등) */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
      };
    };
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
    /** 샘플 데이터 적재(등록). 이미 있거나 만드는 중이면 현재 상태만 돌려준다. 업로드한 데이터셋은 상태만 돌려준다 */
    post: {
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
          column: components["schemas"]["ColumnName"];
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
  "/datasets": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 샘플과 업로드한 데이터셋의 적재 상태 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 데이터셋 목록 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["DatasetListResponse"];
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
  "/datasets/{datasetId}/schema": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 데이터셋 스키마: 적재된 테이블에서 읽은 컬럼과 타입(categorical / numeric / datetime). 적재 중에도 알 수 있다 */
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
        /** @description 컬럼 목록 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["DatasetSchema"];
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
        /** @description 등록하지 않은 데이터셋 */
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
  "/datasets/{datasetId}/split-count": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** split 조합 개수 (최대 개수 초과 검사). 필터가 있으면 필터를 적용해 센다 */
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
          "application/json": components["schemas"]["SplitCountRequest"];
        };
      };
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
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/datasets/uploads": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** CSV 또는 zip(CSV 여러 개를 하나로 합침) 업로드. 파일마다 스키마가 다르면 거절한다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "multipart/form-data": components["schemas"]["UploadDatasetRequest"];
        };
      };
      responses: {
        /** @description 적재 시작 */
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
        /** @description CSV 검사에서 거절 (스키마 불일치 등) */
        422: {
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
    ColumnSummary:
      | {
          /** @enum {string} */
          kind: "range";
          column: components["schemas"]["ColumnName"];
          /** @enum {string} */
          type: "numeric" | "datetime";
          min: number | null;
          max: number | null;
          nullCount: number;
          count: number;
        }
      | {
          /** @enum {string} */
          kind: "values";
          column: components["schemas"]["ColumnName"];
          values: {
            value: string;
            count: number;
          }[];
          nullCount: number;
          count: number;
        };
    /** @example factory */
    ColumnName: string;
    ApiError: {
      /** @example unknown chart */
      error: string;
    };
    /** @example iot-100k */
    DatasetId: string;
    DatasetStatus: {
      id: components["schemas"]["DatasetId"];
      /** @enum {string} */
      kind: "sample" | "upload";
      name: string;
      /** @enum {string} */
      state: "missing" | "generating" | "ready" | "failed";
      /** @enum {string} */
      phase?: "copy" | "analyze";
      done: number;
      total: number;
      generateMs?: number;
      error?: string;
      upload?: components["schemas"]["UploadInfo"];
    };
    UploadInfo: {
      fileName: string;
      size: number;
      files: {
        name: string;
        size: number;
      }[];
      createdAt: number;
      options: components["schemas"]["CsvOptions"];
      inferred: {
        name: string;
        type: components["schemas"]["ColumnType"];
      }[];
    };
    CsvOptions: {
      delimiter: string;
      header: boolean;
      nullValue: string;
      types?: {
        [key: string]: components["schemas"]["ColumnType"];
      };
    };
    /** @enum {string} */
    ColumnType: "categorical" | "numeric" | "datetime";
    EditDatasetRequest: {
      name?: string;
      options?: components["schemas"]["CsvOptions"];
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
      column: components["schemas"]["ColumnName"];
      values: string[];
    };
    DatasetListResponse: {
      datasets: components["schemas"]["DatasetStatus"][];
    };
    DatasetSchema: {
      id: components["schemas"]["DatasetId"];
      ready: boolean;
      columns: components["schemas"]["ColumnInfo"][];
    };
    ColumnInfo: {
      name: components["schemas"]["ColumnName"];
      label: string;
      type: components["schemas"]["ColumnType"];
      nullable: boolean;
      distinct: number | null;
    };
    SplitCountResponse: {
      count: number;
      exact: boolean;
      limit: number;
    };
    SplitCountRequest: {
      cols: components["schemas"]["ColumnName"][];
      filters?: components["schemas"]["ChartFilter"][];
    };
    ChartFilter:
      | components["schemas"]["RangeFilter"]
      | components["schemas"]["ExcludeFilter"];
    RangeFilter: {
      /** @enum {string} */
      kind: "range";
      column: components["schemas"]["ColumnName"];
      min: number;
      max: number;
      inverse: boolean;
      includeNull: boolean;
    };
    ExcludeFilter: {
      /** @enum {string} */
      kind: "exclude";
      column: components["schemas"]["ColumnName"];
      values: string[];
    };
    UploadDatasetRequest: {
      /** Format: binary */
      file: string;
      name: string;
      /** @description CsvOptions JSON */
      options: string;
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

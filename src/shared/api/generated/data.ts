// 자동 생성 파일. 직접 고치지 말고 `pnpm gen:api`로 다시 만든다.

export type paths = {
  "/datasets/staging/{stageId}/check": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 적재하지 않고 파일 전체를 검사한다: 행 수, 컬럼별 타입과 변환 불가 값 수 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          stageId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CheckUploadRequest"];
        };
      };
      responses: {
        /** @description 검사 결과 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["CsvCheck"];
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
        /** @description CSV 검사에서 거절 (옵션·스키마 오류, 올려 둔 파일 없음 등) */
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
  "/datasets/staging/{stageId}/commit": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 올려 둔 파일을 적재한다. 검사·변환부터 백그라운드에서 하고 진행은 task long polling으로 받는다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          stageId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CommitUploadRequest"];
        };
      };
      responses: {
        /** @description 적재 시작 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["UploadTask"];
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
        /** @description CSV 검사에서 거절 (옵션·스키마 오류, 올려 둔 파일 없음 등) */
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
    /** 업로드한 데이터셋의 이름 변경 */
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
          "application/json": components["schemas"]["RenameDatasetRequest"];
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
      };
    };
    trace?: never;
  };
  "/datasets/staging/{stageId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** 올려 둔 파일을 버린다 */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          stageId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 버림 */
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
      };
    };
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
  "/datasets/staging/{stageId}/preview": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 올려 둔 파일 하나의 앞부분: 원본 줄, 컬럼과 추론 타입, 정한 타입으로 바꾼 앞쪽 행 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          stageId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["PreviewUploadRequest"];
        };
      };
      responses: {
        /** @description 미리보기 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["CsvPreview"];
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
        /** @description CSV 검사에서 거절 (옵션·스키마 오류, 올려 둔 파일 없음 등) */
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
  "/datasets/{datasetId}/staging": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 업로드한 데이터셋의 원본을 다시 올려 둔다. 옵션·타입을 바꿔 commit하면 그 데이터셋을 다시 적재한다 */
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
        /** @description 올려 둔 파일 */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["StagedUpload"];
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
        /** @description CSV 검사에서 거절 (옵션·스키마 오류, 올려 둔 파일 없음 등) */
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
  "/datasets/staging": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** CSV 또는 zip(CSV 여러 개를 하나로 합침)을 올려 둔다. 미리보기·검사로 옵션을 정한 뒤 commit으로 적재한다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "multipart/form-data": components["schemas"]["StageUploadRequest"];
        };
      };
      responses: {
        /** @description 올려 둔 파일 */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["StagedUpload"];
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
        /** @description CSV 검사에서 거절 (옵션·스키마 오류, 올려 둔 파일 없음 등) */
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
  "/datasets/staging/{stageId}/task": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 업로드 진행 (long polling). since가 지금 version과 같으면 바뀔 때까지 최대 15초 기다린다 */
    get: {
      parameters: {
        query?: {
          since?: number | null;
        };
        header?: never;
        path: {
          stageId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 진행 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["UploadTask"];
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
        /** @description commit하지 않은 stage */
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
};
export type webhooks = Record<string, never>;
export type components = {
  schemas: {
    CsvCheck: {
      rows: number;
      skipped: number;
      columns: {
        name: string;
        type: components["schemas"]["ColumnType"];
        inferred: components["schemas"]["ColumnType"];
        included: boolean;
        invalid: number;
      }[];
    };
    /** @enum {string} */
    ColumnType: "categorical" | "numeric" | "datetime";
    ApiError: {
      /** @example unknown chart */
      error: string;
    };
    CheckUploadRequest: {
      options: components["schemas"]["CsvOptions"];
    };
    CsvOptions: {
      delimiter: string;
      header: boolean;
      nullValue: string;
      quote: string;
      /** @enum {string} */
      encoding: "auto" | "utf-8" | "euc-kr";
      datetimeFormat: string | null;
      ignoreErrors: boolean;
      types?: {
        [key: string]: components["schemas"]["ColumnType"];
      };
      excluded?: string[];
    };
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
    /** @example iot-100k */
    DatasetId: string;
    UploadTask: {
      /** @enum {string} */
      state:
        | "parse"
        | "queued"
        | "copy"
        | "analyze"
        | "done"
        | "rejected"
        | "failed";
      done: number;
      total: number;
      version: number;
      datasetId?: components["schemas"]["DatasetId"];
      error?: string;
    };
    CommitUploadRequest: {
      name: string;
      options: components["schemas"]["CsvOptions"];
    };
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
    CsvPreview: {
      raw: string[];
      columns: {
        name: string;
        inferred: components["schemas"]["ColumnType"];
        type: components["schemas"]["ColumnType"];
      }[];
      rows: (string | null)[][];
      invalid: [number, number][];
      error?: string;
    };
    PreviewUploadRequest: {
      file: number;
      options: components["schemas"]["CsvOptions"];
    };
    RenameDatasetRequest: {
      name: string;
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
    StagedUpload: {
      stageId: string;
      fileName: string;
      size: number;
      files: {
        name: string;
        size: number;
      }[];
      dataset?: {
        id: components["schemas"]["DatasetId"];
        name: string;
        options: components["schemas"]["CsvOptions"];
      };
    };
    StageUploadRequest: {
      /** Format: binary */
      file: string;
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

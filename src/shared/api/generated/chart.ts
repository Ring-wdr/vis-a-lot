// 자동 생성 파일. 직접 고치지 말고 `pnpm gen:api`로 다시 만든다.

export type paths = {
  "/charts/{chartId}/items/{itemKey}/shapes": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 도형 추가 (데이터 좌표) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          chartId: string;
          itemKey: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["AddShapeRequest"];
        };
      };
      responses: {
        /** @description 다시 그리는 job. long polling으로 진행 상태를 받는다 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ItemJobResponse"];
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
        /** @description 모르는 item */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 아직 그려지지 않았거나 다시 그리는 중 */
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
    /** 도형 전체 삭제 */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          chartId: string;
          itemKey: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 다시 그리는 job. long polling으로 진행 상태를 받는다 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ItemJobResponse"];
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
        /** @description 모르는 item */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 아직 그려지지 않았거나 다시 그리는 중 */
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
    patch?: never;
    trace?: never;
  };
  "/jobs/{jobId}/cancel": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 남은 item을 cancelled로 기록하고 멈춘다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          jobId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 취소 요청됨 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
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
        /** @description 모르는 job */
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
  "/charts/{chartId}/common": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** 공통 속성. 개별 속성을 모두 덮어쓰고 전체를 다시 그린다 */
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          chartId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CommonPropsRequest"];
        };
      };
      responses: {
        /** @description 다시 그리는 job. long polling으로 진행 상태를 받는다 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ItemJobResponse"];
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
        /** @description 모르는 차트 */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 렌더링 중 */
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
    trace?: never;
  };
  "/charts/{chartId}/grid": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** grid 크기. item 크기가 바뀌므로 전체를 다시 그린다 */
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          chartId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["GridRequest"];
        };
      };
      responses: {
        /** @description 다시 그리는 job. long polling으로 진행 상태를 받는다 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ItemJobResponse"];
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
        /** @description 모르는 차트 */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 렌더링 중 */
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
    trace?: never;
  };
  "/charts/{chartId}/items/{itemKey}/props": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** item 개별 색 (null이면 공통 속성을 따름) */
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          chartId: string;
          itemKey: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["ItemPropsRequest"];
        };
      };
      responses: {
        /** @description 다시 그리는 job. long polling으로 진행 상태를 받는다 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ItemJobResponse"];
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
        /** @description 모르는 item */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 아직 그려지지 않았거나 다시 그리는 중 */
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
    trace?: never;
  };
  "/charts/{chartId}/items/{itemKey}/view": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 확대 / 축소 / 초기화. 바뀐 범위로 그 item만 다시 그린다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          chartId: string;
          itemKey: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["ViewRequest"];
        };
      };
      responses: {
        /** @description 다시 그리는 job. long polling으로 진행 상태를 받는다 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ItemJobResponse"];
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
        /** @description 모르는 item */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 아직 그려지지 않았거나 다시 그리는 중 */
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
  "/charts": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 그리기 시작. 데이터가 아직 없어도 받아 두고 job이 init 상태로 기다린다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CreateChartRequest"];
        };
      };
      responses: {
        /** @description 차트와 job id */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["CreateChartResponse"];
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
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/debug/render": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 구조 검증용 렌더 (/dev 페이지) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["DebugRenderRequest"];
        };
      };
      responses: {
        /** @description 렌더 결과 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["DebugRenderResponse"];
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
            "application/json": components["schemas"]["ChartHealth"];
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
  "/history/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 설정과 item별 상태 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description history 한 건 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["HistoryDetail"];
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
        /** @description 모르는 history */
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
  "/history": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 그린 차트 목록 (최근 순) */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 목록 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["HistoryListResponse"];
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
  "/charts/{chartId}/items/{itemKey}/detail": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 크게 보기용 PNG. 같은 내용·같은 크기로 그려 둔 게 있으면 바로 주고, 없으면 그 한 장만 그리는 job을 준다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          chartId: string;
          itemKey: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["DetailRequest"];
        };
      };
      responses: {
        /** @description 그려 둔 PNG 또는 그리는 job */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["DetailResponse"];
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
        /** @description 모르는 item */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 아직 그려지지 않았거나 다시 그리는 중 */
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
  "/charts/{chartId}/items/{itemKey}/meta": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 툴팁용 metadata (축 정보 + 픽셀 기준으로 줄인 점) */
    get: {
      parameters: {
        query?: {
          /** @description 크게 보기 PNG의 크기 (WxH) */
          size?: string;
        };
        header?: never;
        path: {
          chartId: string;
          itemKey: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description metadata */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ItemMeta"];
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
        /** @description metadata가 아직 없음 */
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
  "/jobs/{jobId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** long polling. since 이후 변화가 있거나 요청한 페이지가 모두 끝나면 응답한다. pageSize=0이면 job 전체 진행 상태만 */
    get: {
      parameters: {
        query?: {
          page?: number | null;
          pageSize?: number | null;
          offset?: number | null;
          /** @description 쉼표로 구분한 item 키 */
          items?: string;
          since?: number | null;
        };
        header?: never;
        path: {
          jobId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description job 상태 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["JobStateResponse"];
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
        /** @description 모르는 job */
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
  "/charts/{chartId}/items/{itemKey}/png": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 렌더된 PNG */
    get: {
      parameters: {
        query?: {
          v?: string;
          r?: string;
          size?: string;
        };
        header?: never;
        path: {
          chartId: string;
          itemKey: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description PNG */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "image/png": string;
          };
        };
        /** @description 없음 */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
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
  "/charts/{chartId}/resize": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 화면 크기 변경. 요청한 item만 새 크기로 다시 그린다 (history에 남기지 않음) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          chartId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["ResizeRequest"];
        };
      };
      responses: {
        /** @description 다시 그리는 job. long polling으로 진행 상태를 받는다 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ItemJobResponse"];
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
        /** @description 모르는 차트 */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 렌더링 중 */
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
  "/charts/{chartId}/items/{itemKey}/tooltip": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** x, y 외의 툴팁 컬럼을 행 식별자로 조회 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          chartId: string;
          itemKey: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["TooltipRequest"];
        };
      };
      responses: {
        /** @description 컬럼 값 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["TooltipResponse"];
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
        /** @description 모르는 차트 */
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
  "/charts/{chartId}/items/{itemKey}/shapes/last": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** 마지막 도형 빼기 (undo) */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          chartId: string;
          itemKey: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 다시 그리는 job. long polling으로 진행 상태를 받는다 */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ItemJobResponse"];
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
        /** @description 모르는 item */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 아직 그려지지 않았거나 다시 그리는 중 */
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
    patch?: never;
    trace?: never;
  };
};
export type webhooks = Record<string, never>;
export type components = {
  schemas: {
    ItemJobResponse: {
      jobId: string;
    };
    ApiError: {
      /** @example unknown chart */
      error: string;
    };
    AddShapeRequest: {
      shape: components["schemas"]["Shape"];
    };
    Shape:
      | {
          /** @enum {string} */
          type: "rect";
          x0: number;
          y0: number;
          x1: number;
          y1: number;
        }
      | {
          /** @enum {string} */
          type: "line";
          x0: number;
          y0: number;
          x1: number;
          y1: number;
        }
      | {
          /** @enum {string} */
          type: "freehand";
          points: [number, number][];
        }
      | {
          /** @enum {string} */
          type: "text";
          x: number;
          y: number;
          text: string;
        };
    CommonPropsRequest: {
      common: components["schemas"]["CommonProps"];
    };
    CommonProps: {
      color: components["schemas"]["HexColor"];
      legendColors?: {
        [key: string]: components["schemas"]["HexColor"];
      };
      legendPosition?: components["schemas"]["LegendPosition"];
    };
    /** @example #2a78d6 */
    HexColor: string;
    /** @enum {string} */
    LegendPosition: "top" | "bottom" | "left" | "right";
    GridRequest: {
      grid: components["schemas"]["Grid"];
      itemSize: components["schemas"]["ItemSize"];
    };
    Grid: {
      rows: number;
      cols: number;
    };
    ItemSize: {
      width: number;
      height: number;
    };
    ItemPropsRequest:
      | {
          color: components["schemas"]["HexColor"] | null;
        }
      | {
          legendColor: {
            value: string;
            color: components["schemas"]["HexColor"] | null;
          };
        }
      | {
          legendPosition: components["schemas"]["LegendPosition"] | null;
        };
    ViewRequest:
      | {
          /** @enum {string} */
          type: "zoomIn";
          x: [number, number];
          y: [number, number];
        }
      | {
          /** @enum {string} */
          type: "zoomOut";
          ratio: number;
        }
      | {
          /** @enum {string} */
          type: "reset";
        };
    CreateChartResponse: {
      chartId: string;
      jobId: string;
      historyId: string;
    };
    CreateChartRequest: {
      spec: components["schemas"]["ChartSpec"];
      itemSize: components["schemas"]["ItemSize"];
      restore?: {
        [key: string]: components["schemas"]["ItemRestore"];
      };
      historyId?: string;
      record?: boolean;
    };
    ChartSpec: {
      dataset: components["schemas"]["DatasetId"];
      chartType: components["schemas"]["ChartType"];
      x: components["schemas"]["ColumnName"];
      y: components["schemas"]["ColumnName"];
      agg: components["schemas"]["AggFn"];
      legend: components["schemas"]["ColumnName"] | null;
      splitBy: components["schemas"]["ColumnName"][];
      splitSeparator: string;
      tooltip: components["schemas"]["ColumnName"][];
      grid: components["schemas"]["Grid"];
      common: components["schemas"]["CommonProps"];
      filters?: components["schemas"]["ChartFilter"][];
    };
    /** @example iot-100k */
    DatasetId: string;
    /** @enum {string} */
    ChartType: "scatter" | "bar" | "boxplot";
    /** @example factory */
    ColumnName: string;
    /** @enum {string} */
    AggFn: "avg" | "sum" | "count" | "min" | "max" | "median";
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
    ItemRestore: {
      view?: components["schemas"]["ItemView"];
      shapes: components["schemas"]["Shape"][];
      color?: components["schemas"]["HexColor"];
      legendColors?: {
        [key: string]: components["schemas"]["HexColor"];
      };
      legendPosition?: components["schemas"]["LegendPosition"];
    };
    ItemView: {
      x: [number, number];
      y: [number, number];
    };
    DebugRenderResponse: {
      url: string;
      width: number;
      height: number;
      worker: string;
      renderMs: number;
    };
    DebugRenderRequest: {
      chartId: string;
      itemKey: string;
      width: number;
      height: number;
      points: number;
    };
    ChartHealth: {
      /** @enum {string} */
      service: "chart";
      renderWorkers: number;
    };
    HistoryDetail: components["schemas"]["HistorySummary"] & {
      items: {
        [key: string]: components["schemas"]["HistoryItem"];
      };
      events: {
        type: components["schemas"]["HistoryEventType"];
        at: number;
        item?: string;
      }[];
    };
    /** @enum {string} */
    JobStatus: "init" | "progress" | "success" | "failed" | "cancelled";
    HistoryItem: components["schemas"]["ItemRestore"] & {
      label: string;
      status: components["schemas"]["ItemStatus"];
    };
    /** @enum {string} */
    ItemStatus: "queued" | "running" | "success" | "failed" | "cancelled";
    /** @enum {string} */
    HistoryEventType:
      | "zoom"
      | "shape"
      | "undo"
      | "clearShapes"
      | "color"
      | "legend"
      | "common"
      | "grid";
    HistorySummary: {
      id: string;
      createdAt: number;
      updatedAt: number;
      dataset: components["schemas"]["DatasetId"];
      generatorVersion: number;
      spec: components["schemas"]["ChartSpec"];
      status: components["schemas"]["JobStatus"];
      itemCount: number;
      statusCounts: {
        queued?: number;
        running?: number;
        success?: number;
        failed?: number;
        cancelled?: number;
      };
      eventCounts: {
        zoom?: number;
        shape?: number;
        undo?: number;
        clearShapes?: number;
        color?: number;
        legend?: number;
        common?: number;
        grid?: number;
      };
      thumbnail?: string;
    };
    HistoryListResponse: {
      entries: components["schemas"]["HistorySummary"][];
    };
    DetailResponse:
      | {
          image: components["schemas"]["ChartImage"];
        }
      | {
          jobId: string;
        };
    ChartImage: {
      url: string;
      width: number;
      height: number;
    };
    DetailRequest: {
      itemSize: components["schemas"]["ItemSize"];
    };
    ItemMeta:
      | components["schemas"]["ScatterMeta"]
      | components["schemas"]["CategoryMeta"];
    ScatterMeta: {
      /** @enum {string} */
      chartType: "scatter";
      plot: {
        left: number;
        top: number;
        width: number;
        height: number;
      };
      x: components["schemas"]["AxisMeta"];
      y: components["schemas"]["AxisMeta"];
      points: {
        px: number[];
        py: number[];
        x: number[];
        y: number[];
        id: number[];
        g?: number[];
      };
      total: number;
      legend?: components["schemas"]["LegendMeta"];
    };
    AxisMeta: {
      /** @enum {string} */
      kind: "number" | "time";
      domain: [number, number];
    };
    LegendMeta: {
      title: string;
      values: string[];
      colors: string[];
      box: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      entries: {
        value: string;
        color: string;
        index: number;
        rect: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }[];
      hidden: number;
    };
    CategoryMeta: {
      /** @enum {string} */
      chartType: "bar" | "boxplot";
      plot: {
        left: number;
        top: number;
        width: number;
        height: number;
      };
      x: components["schemas"]["AxisMeta"];
      y: components["schemas"]["AxisMeta"];
      categories: string[];
      markWidth: number;
      groupCount: number;
      groupGap: number;
      agg?: components["schemas"]["AggFn"];
      bars?: (number | null)[][];
      boxes?: (components["schemas"]["BoxSummary"] | null)[][];
      legend?: components["schemas"]["LegendMeta"];
    };
    BoxSummary: {
      n: number;
      mean: number;
      q1: number;
      median: number;
      q3: number;
      lo: number;
      hi: number;
      outlierCount: number;
    };
    JobStateResponse: {
      jobId: string;
      chartId: string;
      version: number;
      status: components["schemas"]["JobStatus"];
      /** @enum {string} */
      phase: "dataset" | "query" | "render";
      progress: {
        done: number;
        total: number;
      };
      totalItems: number | null;
      page: number;
      pageSize: number;
      offset: number;
      items: components["schemas"]["ItemState"][];
      error?: string;
      /** @enum {string} */
      kind: "draw" | "redraw";
      counts: {
        queued: number;
        running: number;
        success: number;
        failed: number;
        cancelled: number;
      };
      timing: {
        createdAt: number;
        renderStartedAt?: number;
        endedAt?: number;
      };
      renderWorkers: number;
    };
    ItemState: {
      key: string;
      label: string;
      status: components["schemas"]["ItemStatus"];
      stage?: components["schemas"]["ItemStage"];
      stageProgress: number;
      image?: components["schemas"]["ChartImage"];
      thumbnail?: components["schemas"]["ChartImage"];
      revision: number;
      error?: string;
      zoomed: boolean;
      shapeCount: number;
      color: string;
      customColor: boolean;
      legendPosition?: components["schemas"]["LegendPosition"];
    };
    /** @enum {string} */
    ItemStage: "query" | "aggregate" | "render" | "encode";
    ResizeRequest: {
      itemSize: components["schemas"]["ItemSize"];
      keys: string[];
    };
    TooltipResponse: {
      values: {
        [key: string]: string | number | null;
      };
    };
    TooltipRequest: {
      rowId: number;
      columns: components["schemas"]["ColumnName"][];
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

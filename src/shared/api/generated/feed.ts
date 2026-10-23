// 자동 생성 파일. 직접 고치지 말고 `pnpm gen:api`로 다시 만든다.

export type paths = {
  "/groups/{groupId}/post-types/{postTypeId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** 게시물 유형 지우기. 그 유형 게시물은 유형 없음이 된다 */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          groupId: string;
          postTypeId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 바뀐 그룹 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["GroupDetail"];
          };
        };
        /** @description 요청 형식 오류, 키 접두사 중복 등 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 그룹 관리자만 */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 그룹(비공개 그룹은 멤버가 아니면 404) */
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
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/groups/{groupId}/teams/{teamId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** 팀 지우기. 그 팀 게시물은 팀 없음이 된다 */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          groupId: string;
          teamId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 바뀐 그룹 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["GroupDetail"];
          };
        };
        /** @description 요청 형식 오류, 키 접두사 중복 등 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 그룹 관리자만 */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 그룹(비공개 그룹은 멤버가 아니면 404) */
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
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/groups/{groupId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 그룹 하나: 멤버, 팀, 게시물 유형 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          groupId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 그룹 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["GroupDetail"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 그룹(비공개 그룹은 멤버가 아니면 404) */
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
    /** 그룹 설정 (이름·설명·비공개·키 접두사·상태 이름) */
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          groupId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["UpdateGroupRequest"];
        };
      };
      responses: {
        /** @description 바뀐 그룹 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["GroupDetail"];
          };
        };
        /** @description 요청 형식 오류, 키 접두사 중복 등 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 그룹 관리자만 */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 그룹(비공개 그룹은 멤버가 아니면 404) */
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
  "/groups": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 볼 수 있는 그룹 목록 (비공개 그룹은 멤버와 시스템 관리자만) */
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
            "application/json": components["schemas"]["GroupListResponse"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/groups/{groupId}/members/{userId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** 멤버 추가 또는 역할 바꾸기 */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          groupId: string;
          userId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["SetMemberRequest"];
        };
      };
      responses: {
        /** @description 바뀐 그룹 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["GroupDetail"];
          };
        };
        /** @description 요청 형식 오류, 키 접두사 중복 등 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 그룹 관리자만 */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 그룹(비공개 그룹은 멤버가 아니면 404) */
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
    post?: never;
    /** 멤버 빼기. 마지막 그룹 관리자는 뺄 수 없다(400) */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          groupId: string;
          userId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 바뀐 그룹 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["GroupDetail"];
          };
        };
        /** @description 요청 형식 오류, 키 접두사 중복 등 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 그룹 관리자만 */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 그룹(비공개 그룹은 멤버가 아니면 404) */
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
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/groups/{groupId}/post-types": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 게시물 유형 만들기(id 없음) 또는 바꾸기 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          groupId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["SavePostTypeRequest"];
        };
      };
      responses: {
        /** @description 바뀐 그룹 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["GroupDetail"];
          };
        };
        /** @description 요청 형식 오류, 키 접두사 중복 등 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 그룹 관리자만 */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 그룹(비공개 그룹은 멤버가 아니면 404) */
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
  "/groups/{groupId}/teams": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 팀 만들기(id 없음) 또는 이름 바꾸기 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          groupId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["SaveTeamRequest"];
        };
      };
      responses: {
        /** @description 바뀐 그룹 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["GroupDetail"];
          };
        };
        /** @description 요청 형식 오류, 키 접두사 중복 등 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 그룹 관리자만 */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 그룹(비공개 그룹은 멤버가 아니면 404) */
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
  "/notifications/archive": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 보관 (읽음도 함께 표시) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["NotificationIdsRequest"];
        };
      };
      responses: {
        /** @description 바꾼 뒤 안읽음 수 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["UnreadCountResponse"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
  "/notifications": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 알림함 (게시물별 묶음) */
    get: {
      parameters: {
        query?: {
          unreadOnly?: "true" | "false";
          archived?: "true" | "false";
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 알림함 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["InboxResponse"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/notifications/settings": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 이벤트 × 채널 설정. 저장하지 않은 이벤트는 기본값 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 설정 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["NotificationSettings"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
    /** 설정 저장 (보낸 이벤트만 덮어쓴다) */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["NotificationSettings"];
        };
      };
      responses: {
        /** @description 저장 뒤 전체 설정 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["NotificationSettings"];
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
        /** @description 사용자를 고르지 않음 */
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
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/notifications/unread-count": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 보관하지 않은 안읽음 수 (상단 배지) */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 수 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["UnreadCountResponse"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/outbox": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 슬랙·이메일로 나갔을 메시지 (최근 순, 프로토타입 전용) */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 발송 로그 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["OutboxResponse"];
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
  "/notifications/read": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 읽음 표시 (내 알림만) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["NotificationIdsRequest"];
        };
      };
      responses: {
        /** @description 바꾼 뒤 안읽음 수 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["UnreadCountResponse"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
  "/notifications/unread": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 안읽음으로 되돌리기 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["NotificationIdsRequest"];
        };
      };
      responses: {
        /** @description 바꾼 뒤 안읽음 수 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["UnreadCountResponse"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
  "/posts/{postId}/checklist": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 체크리스트 항목 추가. 진행률을 다시 계산한다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["AddChecklistItemRequest"];
        };
      };
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
  "/posts/{postId}/relations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 관계 추가 (이 게시물이 from) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["RelationRequest"];
        };
      };
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
  "/posts/{postId}/approve": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 승인: 검토 중 → 해결됨 (요청자·그룹 관리자) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
  "/posts/bulk": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 일괄 변경. 게시물마다 update/transition과 같은 규칙으로 바꾸고, 못 바꾼 것은 이유와 함께 돌려준다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["BulkUpdateRequest"];
        };
      };
      responses: {
        /** @description 결과 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["BulkUpdateResponse"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
  "/posts": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 게시물 만들기. next_seq로 키를 발급하고 created 이력을 남기며 작성자·담당자·요청자·이해관계자를 구독시킨다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CreatePostRequest"];
        };
      };
      responses: {
        /** @description 만든 게시물 */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 그룹 */
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
  "/posts/{postId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 게시물 하나: 관계·체크리스트·이해관계자·구독 여부·첨부·권한 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
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
    /** 소프트 삭제 (작성자·그룹 관리자) */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 지움 */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
    /** 게시물 고치기. 바뀐 필드마다 변경 이력 한 줄 */
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["UpdatePostRequest"];
        };
      };
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
  "/posts/my-summary": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 홈 상단 내 작업 요약 (담당·승인 대기·기한 임박 수) */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 요약 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["MyWorkSummary"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/posts/{postId}/events": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 변경 이력 (오래된 순). 활동 로그 타임라인 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 이력 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostEventsResponse"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
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
  "/posts/{postId}/pin": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** 홈 피드에서 끌어올리기 켜기·끄기 */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["PinRequest"];
        };
      };
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/posts/query": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 게시물 목록 (필터·정렬·페이지). 지운 것과 볼 수 없는 비공개 그룹은 뺀다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["PostQueryRequest"];
        };
      };
      responses: {
        /** @description 목록 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostQueryResponse"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
  "/posts/{postId}/reject": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 반려: 검토 중 → 진행 중, 반려 사유를 댓글로 남긴다 (요청자·그룹 관리자) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["RejectRequest"];
        };
      };
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
  "/posts/{postId}/checklist/{itemId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** 체크리스트 항목 지우기 */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
          itemId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
    /** 체크리스트 항목 고치기·체크 */
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
          itemId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["UpdateChecklistItemRequest"];
        };
      };
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
  "/posts/{postId}/relations/remove": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 관계 지우기 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["RelationRequest"];
        };
      };
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
  "/posts/{postId}/reopen": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 다시 열기: 해결됨·취소 → 미해결, reopen_count 증가 (요청자·작성자·그룹 관리자) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
  "/posts/{postId}/checklist/order": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** 체크리스트 순서 (ids 순서대로) */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["ReorderChecklistRequest"];
        };
      };
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/posts/{postId}/request-review": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 완료 요청: 진행 중 → 검토 중 (담당자) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
  "/posts/{postId}/parent": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** 상위 이슈 정하기(null이면 떼기). 같은 그룹만, 순환 금지. 상위 진행률을 다시 계산한다 */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["SetParentRequest"];
        };
      };
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/posts/{postId}/subscribe": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** 알림 구독 켜기·끄기 */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["SubscribeRequest"];
        };
      };
      responses: {
        /** @description 지금 상태 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["SubscribeResponse"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
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
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/posts/{postId}/transition": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 상태 전이 (규칙·권한 검사). 보류는 사유+재개일, 취소는 사유가 필수 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          postId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["TransitionRequest"];
        };
      };
      responses: {
        /** @description 바뀐 게시물 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["PostDetail"];
          };
        };
        /** @description 요청 형식 오류, 필드 사이 규칙 위반 */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 권한 없음 (전이 규칙, 그룹 역할) */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 게시물 (볼 수 없는 비공개 그룹 포함) */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 지금 상태에서 할 수 없는 전이 */
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
  "/scheduler/run": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 기한 알림(D-1·당일·초과, 게시물마다 하루 1회)과 보류 자동 복귀. 같은 날 여러 번 불러도 한 번만 만든다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 이번에 한 일 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["SchedulerRunResponse"];
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
  "/seed/export": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 피드 데이터 전체를 JSON으로 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 스냅숏 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["FeedSnapshot"];
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
  "/seed/import": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 피드 데이터를 지우고 스냅숏으로 채운다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["FeedSnapshot"];
        };
      };
      responses: {
        /** @description 넣은 행 수 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["SeedImportResponse"];
          };
        };
        /** @description 스키마 버전이 다르거나 형식 오류 */
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
  "/system/bootstrap": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 비어 있으면 기본 시나리오를 적재한다. 화면이 처음 뜰 때 부른다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 적재 뒤 상태 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["FeedStatus"];
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
  "/system/clock": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 시계 오프셋과 피드의 지금 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 시계 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["FeedClock"];
          };
        };
      };
    };
    /** 시계 오프셋 바꾸기 (/feed/dev/clock). 0이면 실제 시각 */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["FeedClockRequest"];
        };
      };
      responses: {
        /** @description 바꾼 시계 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["FeedClock"];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/system/status": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 피드 DB의 사용자·게시물 수 */
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
            "application/json": components["schemas"]["FeedStatus"];
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
  "/system/reset": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 피드 스키마를 지우고 기본 시나리오를 다시 적재한다 (/feed/dev/seed) */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 적재 뒤 상태 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["FeedStatus"];
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
  "/users/{userId}/deactivate": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 사용자 비활성화. 담당·요청 중인 열린 게시물을 돌려줘 재배정을 안내한다 */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          userId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 비활성화한 사용자 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["DeactivateResponse"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 시스템 관리자만 */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 사용자 */
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
  "/users/{userId}/follow": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** 관심(팔로우) 켜기·끄기 */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          userId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["FollowRequest"];
        };
      };
      responses: {
        /** @description 지금 상태 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["FollowResponse"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 사용자 */
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
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/users/me": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 지금 사용자 */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description 지금 사용자 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["Me"];
          };
        };
        /** @description 사용자를 고르지 않음 */
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
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/users": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 사용자 목록 (사용자 전환, 담당자 고르기). 비활성 사용자 포함 */
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
            "application/json": components["schemas"]["UserListResponse"];
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
  "/users/{userId}/admin": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** 시스템 관리자 지정·해제 */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          userId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["SetAdminRequest"];
        };
      };
      responses: {
        /** @description 바뀐 사용자 */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["FeedUser"];
          };
        };
        /** @description 사용자를 고르지 않음 */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 시스템 관리자만 */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["ApiError"];
          };
        };
        /** @description 모르는 사용자 */
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
    GroupDetail: components["schemas"]["Group"] & {
      members: components["schemas"]["GroupMember"][];
      teams: components["schemas"]["Team"][];
      postTypes: components["schemas"]["PostType"][];
    };
    StatusNames: {
      unresolved?: string;
      in_progress?: string;
      in_review?: string;
      resolved?: string;
      on_hold?: string;
      cancelled?: string;
    };
    /** @enum {string|null} */
    GroupRole: "admin" | "member" | null;
    GroupMember: {
      userId: string;
      role: components["schemas"]["GroupRole"];
    };
    Team: {
      id: string;
      name: string;
    };
    PostType: {
      id: string;
      name: string;
      color: string | null;
      sort: number;
    };
    Group: {
      id: string;
      name: string;
      keyPrefix: string;
      description: string | null;
      isPrivate: boolean;
      statusNames: components["schemas"]["StatusNames"];
      myRole: components["schemas"]["GroupRole"];
      memberCount: number;
    };
    ApiError: {
      /** @example unknown chart */
      error: string;
    };
    GroupListResponse: {
      groups: components["schemas"]["Group"][];
    };
    SavePostTypeRequest: {
      id?: string;
      name: string;
      color: string | null;
      sort?: number;
    };
    SaveTeamRequest: {
      id?: string;
      name: string;
    };
    SetMemberRequest: {
      role: components["schemas"]["GroupRole"];
    };
    UpdateGroupRequest: {
      name?: string;
      description?: string | null;
      isPrivate?: boolean;
      keyPrefix?: string;
      statusNames?: components["schemas"]["StatusNames"];
    };
    UnreadCountResponse: {
      count: number;
    };
    NotificationIdsRequest: {
      ids: string[];
    };
    InboxResponse: {
      groups: components["schemas"]["InboxGroup"][];
      unreadTotal: number;
    };
    InboxGroup: {
      post: components["schemas"]["PostRef"];
      notifications: components["schemas"]["Notification"][];
      unread: number;
    };
    PostRef: {
      id: string;
      key: string;
      title: string;
      status: components["schemas"]["PostStatus"];
      groupId: string;
    };
    /** @enum {string} */
    PostStatus:
      | "unresolved"
      | "in_progress"
      | "in_review"
      | "resolved"
      | "on_hold"
      | "cancelled";
    Notification: {
      id: string;
      kind: components["schemas"]["NotifyKind"];
      event: components["schemas"]["FeedEvent"];
      readAt: components["schemas"]["Instant"] & (string | null);
      archivedAt: components["schemas"]["Instant"] & (string | null);
      createdAt: components["schemas"]["Instant"];
    };
    /** @enum {string} */
    NotifyKind:
      | "assigned"
      | "mention"
      | "comment"
      | "status"
      | "review_requested"
      | "approved"
      | "rejected"
      | "due_soon"
      | "overdue"
      | "hold_resumed"
      | "unblocked"
      | "children_resolved";
    FeedEvent: {
      id: string;
      postId: string;
      actorId: string;
      kind: string;
      field: string | null;
      oldValue: string | null;
      newValue: string | null;
      commentId: string | null;
      createdAt: components["schemas"]["Instant"];
    };
    Instant: string;
    NotificationSettings: {
      settings: components["schemas"]["NotificationSetting"][];
    };
    NotificationSetting: {
      kind: components["schemas"]["NotifyKind"];
      inapp: boolean;
      slack: boolean;
      email: boolean;
    };
    OutboxResponse: {
      messages: components["schemas"]["OutboxMessage"][];
    };
    OutboxMessage: {
      id: string;
      /** @enum {string} */
      channel: "slack" | "email";
      recipient: string;
      subject: string | null;
      body: string;
      createdAt: components["schemas"]["Instant"];
    };
    PostDetail: components["schemas"]["PostSummary"] & {
      body?: unknown;
      payload?: unknown;
      reopenCount: number;
      checklist: components["schemas"]["ChecklistItem"][];
      relations: components["schemas"]["PostRelation"][];
      parent: components["schemas"]["PostRef"] & (Record<string, never> | null);
      children: components["schemas"]["PostRef"][];
      attachments: components["schemas"]["Attachment"][];
      subscribed: boolean;
      permissions: components["schemas"]["PostPermissions"];
    };
    /** @enum {string} */
    PostFormat: "chart" | "image" | "video" | "code";
    /** @enum {string} */
    StatusCategory: "open" | "paused" | "closed";
    Priority: number;
    /** @example 2026-10-23 */
    Day: string | null;
    ChecklistItem: {
      id: string;
      text: string;
      done: boolean;
      sort: number;
    };
    PostRelation: {
      kind: components["schemas"]["RelationKind"];
      /** @enum {string} */
      direction: "outgoing" | "incoming";
      post: components["schemas"]["PostRef"];
    };
    /** @enum {string} */
    RelationKind: "blocks" | "duplicate" | "relates" | "derived";
    Attachment: {
      id: string;
      /** @enum {string} */
      kind: "file" | "link";
      name: string;
      url: string;
    };
    PostPermissions: {
      edit: boolean;
      transitions: components["schemas"]["PostStatus"][];
      requestReview: boolean;
      approve: boolean;
      reject: boolean;
      reopen: boolean;
      delete: boolean;
    };
    PostSummary: {
      id: string;
      key: string;
      groupId: string;
      teamId: string | null;
      postTypeId: string | null;
      format: components["schemas"]["PostFormat"];
      title: string;
      status: components["schemas"]["PostStatus"];
      category: components["schemas"]["StatusCategory"];
      priority: components["schemas"]["Priority"];
      progress: number;
      authorId: string;
      assigneeId: string | null;
      requesterId: string | null;
      stakeholderIds: string[];
      parentId: string | null;
      dueDate: components["schemas"]["Day"];
      holdUntil: components["schemas"]["Day"];
      closeReason: string | null;
      tags: string[];
      thumbnail: string | null;
      pinnedAt: components["schemas"]["Instant"] & (string | null);
      createdAt: components["schemas"]["Instant"];
      updatedAt: components["schemas"]["Instant"];
      resolvedAt: components["schemas"]["Instant"] & (string | null);
      commentCount: number;
      childCount: number;
      childResolvedCount: number;
      blocked: boolean;
    };
    AddChecklistItemRequest: {
      text: string;
    };
    RelationRequest: {
      toId: string;
      kind: components["schemas"]["RelationKind"];
    };
    BulkUpdateResponse: {
      updated: string[];
      failed: {
        id: string;
        error: string;
      }[];
    };
    BulkUpdateRequest: {
      ids: string[];
      patch: {
        status?: components["schemas"]["PostStatus"];
        priority?: components["schemas"]["Priority"];
        assigneeId?: string | null;
        dueDate?: components["schemas"]["Day"];
        postTypeId?: string | null;
        teamId?: string | null;
      };
    };
    CreatePostRequest: {
      groupId: string;
      title: string;
      format?: components["schemas"]["PostFormat"];
      postTypeId?: string | null;
      teamId?: string | null;
      priority?: components["schemas"]["Priority"];
      body?: unknown;
      payload?: unknown;
      thumbnail?: string | null;
      assigneeId?: string | null;
      requesterId?: string | null;
      /** @default [] */
      stakeholderIds: string[];
      dueDate?: components["schemas"]["Day"];
      parentId?: string | null;
      /** @default [] */
      checklist: string[];
      /** @default [] */
      tags: string[];
      /** @default [] */
      attachments: {
        /** @enum {string} */
        kind: "file" | "link";
        name: string;
        url: string;
      }[];
    };
    MyWorkSummary: {
      assigned: number;
      awaitingReview: number;
      dueSoon: number;
    };
    PostEventsResponse: {
      events: components["schemas"]["FeedEvent"][];
    };
    PinRequest: {
      on: boolean;
    };
    PostQueryResponse: {
      posts: components["schemas"]["PostSummary"][];
      total: number;
    };
    PostQueryRequest: {
      filter?: components["schemas"]["PostFilter"];
      /**
       * @default {
       *       "field": "updatedAt",
       *       "dir": "desc"
       *     }
       */
      sort: {
        field: components["schemas"]["PostSortField"];
        /** @enum {string} */
        dir: "asc" | "desc";
      };
      /** @default false */
      pinnedFirst: boolean;
      /** @default 0 */
      offset: number;
      /** @default 100 */
      limit: number;
    };
    /** @default {} */
    PostFilter: {
      groupIds?: string[];
      teamIds?: string[];
      statuses?: components["schemas"]["PostStatus"][];
      categories?: components["schemas"]["StatusCategory"][];
      priorities?: components["schemas"]["Priority"][];
      assigneeIds?: string[];
      requesterIds?: string[];
      stakeholderIds?: string[];
      authorIds?: string[];
      postTypeIds?: string[];
      formats?: components["schemas"]["PostFormat"][];
      tags?: string[];
      dueFrom?: components["schemas"]["Day"];
      dueTo?: components["schemas"]["Day"];
      overdue?: boolean;
      q?: string;
      /** @enum {string} */
      mine?: "assigned" | "requested" | "review" | "stakeholder";
      followedAuthors?: boolean;
      parentId?: string;
    };
    /** @enum {string} */
    PostSortField:
      | "updatedAt"
      | "createdAt"
      | "dueDate"
      | "priority"
      | "key"
      | "title"
      | "status";
    RejectRequest: {
      comment: string;
    };
    ReorderChecklistRequest: {
      ids: string[];
    };
    SetParentRequest: {
      parentId: string | null;
    };
    SubscribeResponse: {
      subscribed: boolean;
    };
    SubscribeRequest: {
      on: boolean;
    };
    TransitionRequest: {
      to: components["schemas"]["PostStatus"];
      reason?:
        | components["schemas"]["HoldReason"]
        | components["schemas"]["CancelReason"];
      holdUntil?: components["schemas"]["Day"];
    };
    /** @enum {string} */
    HoldReason: "dependency" | "decision" | "resource";
    /** @enum {string} */
    CancelReason:
      | "duplicate"
      | "cannot_reproduce"
      | "out_of_scope"
      | "low_priority";
    UpdateChecklistItemRequest: {
      text?: string;
      done?: boolean;
    };
    UpdatePostRequest: {
      title?: string;
      body?: unknown;
      payload?: unknown;
      thumbnail?: string | null;
      format?: components["schemas"]["PostFormat"];
      postTypeId?: string | null;
      teamId?: string | null;
      priority?: components["schemas"]["Priority"];
      assigneeId?: string | null;
      requesterId?: string | null;
      stakeholderIds?: string[];
      dueDate?: components["schemas"]["Day"];
      progress?: number;
      tags?: string[];
    };
    SchedulerRunResponse: {
      dueSoon: number;
      overdue: number;
      resumed: number;
    };
    FeedSnapshot: {
      schemaVersion: number;
      exportedAt: string;
      tables: {
        [key: string]: {
          [key: string]: unknown;
        }[];
      };
    };
    SeedImportResponse: {
      rows: number;
    };
    FeedStatus: {
      users: number;
      posts: number;
    };
    FeedClock: {
      offsetMs: number;
      now: string;
    };
    FeedClockRequest: {
      offsetMs: number;
    };
    DeactivateResponse: {
      user: components["schemas"]["FeedUser"];
      openPosts: components["schemas"]["PostRef"][];
    };
    FeedUser: {
      id: string;
      name: string;
      email: string | null;
      isAdmin: boolean;
      active: boolean;
    };
    FollowResponse: {
      following: boolean;
    };
    FollowRequest: {
      on: boolean;
    };
    Me: components["schemas"]["FeedUser"] & {
      following: string[];
    };
    UserListResponse: {
      users: components["schemas"]["FeedUser"][];
    };
    SetAdminRequest: {
      on: boolean;
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

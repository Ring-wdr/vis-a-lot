// 피드 서비스의 사용자 식별. OAS 생성기(registry)도 import하므로 런타임(Worker)을 끌어오지 않게 따로 둔다.

/** 프로토타입은 로그인 대신 화면에서 고른 사용자 id를 이 헤더로 보낸다. */
export const FEED_USER_HEADER = "x-feed-user";

/** OAS 문서에 붙는 보안 요구사항 (헤더 x-feed-user) */
export const FEED_USER = [{ feedUser: [] }];

/** 피드 서비스 OAS의 보안 스킴. 서비스 앱과 OAS 생성기(registry)가 같이 쓴다. */
export const FEED_SECURITY_SCHEMES = {
  feedUser: {
    type: "apiKey",
    in: "header",
    name: FEED_USER_HEADER,
    description: "프로토타입 사용자 전환. 화면에서 고른 사용자 id",
  },
} as const;

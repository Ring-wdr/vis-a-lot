// 피드 API 타입. 모두 피드 서비스 OAS에서 생성한 컴포넌트 타입이다.

import type { components } from "@/shared/api/generated/feed";

type Feed = components["schemas"];

export type FeedStatus = Feed["FeedStatus"];
export type FeedClock = Feed["FeedClock"];

// 피드 도메인 함수(op)의 공통 틀. 모든 op는 DB Worker 안에서 트랜잭션 하나로 돈다.
// 쓰기 op는 "바꾸기 → events 기록(recordEvent) → 알림 생성(dispatch)" 순으로 같은 트랜잭션에서 끝낸다.

import type { Transaction } from "kysely";
import type { FeedDatabase } from "./db";

/** op를 부른 사용자. 프로토타입은 로그인 대신 화면의 사용자 전환으로 정한다. */
export type Actor = {
  id: string;
  name: string;
  isAdmin: boolean;
};

export type OpCtx = {
  db: Transaction<FeedDatabase>;
  /** 사용자 전환 전(목록 조회·시드)처럼 사용자가 없을 수 있다. 필요하면 requireActor로 꺼낸다. */
  actor: Actor | null;
  /** 시계 오프셋이 반영된 지금. created_at 같은 시각은 모두 이 값으로 쓴다. */
  now: Date;
};

// biome-ignore lint/suspicious/noExplicitAny: op마다 인자·결과 타입이 달라 묶음 타입에서는 any로 받는다.
export type Op = (ctx: OpCtx, args: any) => Promise<unknown>;

/** 모듈별 op 묶음. 키는 '모듈.함수' (예: 'posts.list'). */
export function defineOps<T extends Record<string, Op>>(ops: T) {
  return ops;
}

/** API에 HTTP 상태로 그대로 옮겨지는 도메인 오류 */
export class FeedError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export function requireActor(ctx: OpCtx): Actor {
  if (!ctx.actor) throw new FeedError(401, "사용자를 먼저 고르세요");
  return ctx.actor;
}

/** 새 id. 시드와 테스트가 같은 형식을 쓰도록 접두사를 붙인다 (예: 'p_…'). */
export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

// 알림 생성(dispatch). 구독자 × 이벤트 종류 × 알림 설정으로 notifications를 만들고,
// 슬랙·이메일은 outbox에 기록한다. (구현: 알림 모듈 작업)

import type { OpCtx } from "./context";
import type { EventRecord } from "./events";

export async function dispatchEvent(
  _ctx: OpCtx,
  _event: EventRecord,
  _extraRecipients: string[],
): Promise<void> {}

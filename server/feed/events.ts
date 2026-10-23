// 변경 이력(events) 기록. 활동 로그·알림·보고서가 모두 이 테이블을 읽는다.
// 쓰기 op는 바꾼 뒤 같은 트랜잭션에서 recordEvent를 부르고, recordEvent가 알림을 만든다(dispatch).

import { newId, type OpCtx, requireActor } from "./context";
import { dispatchEvent } from "./dispatch";

export const EVENT_KINDS = [
  "created",
  "status",
  "assignee",
  "priority",
  "due",
  "progress",
  "comment",
  "mention",
  "review_requested",
  "approved",
  "rejected",
  "reopened",
  "relation",
  "checklist",
  // 다른 게시물의 변화나 scheduler가 만드는 이벤트
  "due_soon",
  "overdue",
  "hold_resumed",
  "unblocked",
  "children_resolved",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export type EventInput = {
  postId: string;
  kind: EventKind;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  commentId?: string;
  /** 알림을 받을 사람을 더한다 (멘션된 사람 등). 구독자는 dispatch가 알아서 찾는다. */
  extraRecipients?: string[];
  /** 기본은 ctx.actor. scheduler처럼 사람이 없는 이벤트는 작성자 등을 넣는다. */
  actorId?: string;
};

export type EventRecord = {
  id: string;
  postId: string;
  actorId: string;
  kind: EventKind;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  commentId: string | null;
  createdAt: Date;
};

export async function recordEvent(
  ctx: OpCtx,
  input: EventInput,
): Promise<EventRecord> {
  const actorId = input.actorId ?? requireActor(ctx).id;
  const event: EventRecord = {
    id: newId("e"),
    postId: input.postId,
    actorId,
    kind: input.kind,
    field: input.field ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    commentId: input.commentId ?? null,
    createdAt: ctx.now,
  };
  await ctx.db
    .insertInto("events")
    .values({
      id: event.id,
      post_id: event.postId,
      actor_id: event.actorId,
      kind: event.kind,
      field: event.field,
      old_value: event.oldValue,
      new_value: event.newValue,
      comment_id: event.commentId,
      created_at: event.createdAt,
    })
    .execute();
  await dispatchEvent(ctx, event, input.extraRecipients ?? []);
  return event;
}

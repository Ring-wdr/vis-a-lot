// 활동 로그 문장. 변경 이력(FeedEvent) 한 줄을 "김지훈님이 상태를 진행 중 → 검토 중으로 바꿨습니다"처럼 읽는다.
// 영어는 "Kim changed status In progress → In review"처럼 이름 뒤에 동사를 붙인다.
// 문구는 ./messages/{ko,en}.json (Paraglide, 키 event_*). 메시지에는 함수를 둘 수 없어 조사는 여기서 붙여
// 따로 넘긴다 (toRo = josa(to, "으로/로")). 한국어 문구만 그 값을 쓰고 영어 문구는 원래 값을 쓴다.

import type {
  FeedEvent,
  PostStatus,
  StatusNames,
} from "@/shared/api/feed/types";
import * as m from "@/shared/lib/paraglide/messages/_index.js";
import { priorityLabel, relationLabels, statusLabel } from "./labels";

// 숫자를 한국어로 읽었을 때 받침: 0 영 1 일 2 이 3 삼 4 사 5 오 6 육 7 칠 8 팔 9 구
const DIGIT_BATCHIM = [
  true,
  true,
  false,
  true,
  false,
  false,
  true,
  true,
  true,
  false,
];
const DIGIT_RIEUL = [
  false,
  true,
  false,
  false,
  false,
  false,
  false,
  true,
  true,
  false,
];

/** 마지막 글자의 받침: 없음 / ㄹ / 그 밖 */
function batchim(word: string): "none" | "rieul" | "other" {
  const last = word.trim().at(-1) ?? "";
  if (/\d/.test(last)) {
    const d = Number(last);
    return DIGIT_RIEUL[d] ? "rieul" : DIGIT_BATCHIM[d] ? "other" : "none";
  }
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "none";
  const final = code % 28;
  return final === 0 ? "none" : final === 8 ? "rieul" : "other";
}

/** 조사를 붙인다. "으로"는 ㄹ 받침 뒤에서 "로"가 된다 */
export function josa(
  word: string,
  pair: "을/를" | "이/가" | "과/와" | "으로/로",
) {
  const b = batchim(word);
  const [withB, withoutB] = pair.split("/");
  if (pair === "으로/로") return word + (b === "other" ? withB : withoutB);
  return word + (b === "none" ? withoutB : withB);
}

export type EventTextContext = {
  userName: (id: string | null) => string;
  statusNames?: StatusNames;
};

/** 사람이 아니라 시스템(scheduler·다른 게시물의 변화)이 남기는 이벤트 */
const SYSTEM_KINDS = new Set([
  "due_soon",
  "overdue",
  "hold_resumed",
  "unblocked",
  "children_resolved",
]);

export function isSystemEvent(e: FeedEvent) {
  return SYSTEM_KINDS.has(e.kind);
}

// 영어 문구만 쓰는 경우에도 늘 계산하므로, 표에 없는 값(undefined)이 와도 멈추지 않게 문자열로 바꾼다.
const ro = (word: string) => josa(String(word), "으로/로");

/** 행위자 이름을 뺀 문장 (행위자는 따로 굵게 붙인다) */
export function eventText(e: FeedEvent, ctx: EventTextContext): string {
  const status = (s: string | null) =>
    s ? statusLabel(s as PostStatus, ctx.statusNames) : m.event_none();
  const change = (from: string, to: string) => ({ from, to, toRo: ro(to) });

  switch (e.kind) {
    case "created":
      return m.event_created();
    case "status":
      return m.event_status_changed(
        change(status(e.oldValue), status(e.newValue)),
      );
    case "assignee":
      if (!e.newValue) return m.event_assignee_cleared();
      if (!e.oldValue)
        return m.event_assignee_set({ name: ctx.userName(e.newValue) });
      return m.event_assignee_changed(
        change(ctx.userName(e.oldValue), ctx.userName(e.newValue)),
      );
    case "priority":
      return m.event_priority_changed(
        change(
          priorityLabel(Number(e.oldValue)),
          priorityLabel(Number(e.newValue)),
        ),
      );
    case "due":
      if (!e.newValue) return m.event_due_cleared();
      if (!e.oldValue)
        return m.event_due_set({ due: e.newValue, dueRo: ro(e.newValue) });
      return m.event_due_changed(change(e.oldValue, e.newValue));
    case "progress":
      return m.event_progress_changed({
        from: e.oldValue ?? "0",
        to: e.newValue ?? "0",
      });
    case "comment":
      return m.event_commented();
    case "mention": {
      const place = e.commentId ? "comment" : "description";
      const name = e.newValue ? ctx.userName(e.newValue) : undefined;
      return name
        ? m.event_mentioned_user({ place, name })
        : m.event_mentioned({ place });
    }
    case "review_requested":
      return m.event_review_requested();
    case "approved":
      return m.event_approved();
    case "rejected":
      return m.event_rejected();
    case "reopened":
      return m.event_reopened();
    case "relation": {
      if (e.field === "parent") {
        if (e.newValue && e.oldValue)
          return m.event_parent_changed(change(e.oldValue, e.newValue));
        if (e.newValue)
          return m.event_parent_set({ to: e.newValue, toRo: ro(e.newValue) });
        const from = e.oldValue ?? "";
        return m.event_parent_removed({ from, fromEul: josa(from, "을/를") });
      }
      const relations = relationLabels();
      const label =
        relations[e.field as keyof typeof relations] ?? e.field ?? "";
      const target = (e.newValue || e.oldValue) ?? "";
      const args = { target, targetWa: josa(target, "과/와"), label };
      return e.newValue
        ? m.event_relation_added(args)
        : m.event_relation_removed(args);
    }
    case "checklist":
      return m.event_checklist({
        item: e.field ?? "",
        action: e.newValue ?? "",
      });
    case "due_soon":
      return m.event_due_soon({ due: e.newValue ?? "" });
    case "overdue":
      return m.event_overdue({ due: e.newValue ?? "" });
    case "hold_resumed":
      return m.event_hold_resumed();
    case "unblocked":
      return e.newValue != null
        ? m.event_unblocked_by({
            blocker: e.newValue,
            blockerIga: josa(e.newValue, "이/가"),
          })
        : m.event_unblocked();
    case "children_resolved":
      return m.event_children_resolved();
    default:
      return m.event_other({ kind: e.kind });
  }
}

/** 문장 전체: 사람이 한 일은 "김지훈님이 …", 시스템 이벤트는 문장만 */
export function eventSentence(e: FeedEvent, ctx: EventTextContext) {
  const text = eventText(e, ctx);
  return isSystemEvent(e)
    ? text
    : m.event_sentence({ actor: ctx.userName(e.actorId), text });
}

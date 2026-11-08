// 활동 로그 문장. 문구는 Lingui 메시지이고 조사는 받침(batchim)을 select 인자로 넘겨 한국어 문구 안에서 고른다.
// 영어 번역(config/locales/en.po)은 그 인자를 쓰지 않는다.
// 변경 이력(FeedEvent) 한 줄을 "김지훈님이 상태를 진행 중 → 검토 중으로 바꿨습니다"처럼 읽는다.
// 영어는 "Kim changed status In progress → In review"처럼 이름 뒤에 동사를 붙인다.

import { select, t } from "@lingui/core/macro";
import type {
  FeedEvent,
  PostStatus,
  StatusNames,
} from "@/shared/api/feed/types";
import "../config/messages";
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

export type Batchim = "none" | "rieul" | "other";

/** 마지막 글자의 받침: 없음 / ㄹ / 그 밖. 문구에서는 ICU select로 조사를 고른다. */
export function batchim(word: string): Batchim {
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

/** 행위자 이름을 뺀 문장 (행위자는 따로 굵게 붙인다) */
export function eventText(e: FeedEvent, ctx: EventTextContext): string {
  const status = (s: string | null) =>
    s ? statusLabel(s as PostStatus, ctx.statusNames) : t`없음`;

  switch (e.kind) {
    case "created":
      return t`게시물을 만들었습니다`;
    case "status": {
      const from = status(e.oldValue);
      const to = status(e.newValue);
      const toB = batchim(to);
      return t`상태를 ${from} → ${to}${select(toB, { none: "로", rieul: "로", other: "으로" })} 바꿨습니다`;
    }
    case "assignee": {
      if (!e.newValue) return t`담당자를 비웠습니다`;
      const to = ctx.userName(e.newValue);
      if (!e.oldValue) return t`${to}님을 담당자로 정했습니다`;
      const from = ctx.userName(e.oldValue);
      const toB = batchim(to);
      return t`담당자를 ${from} → ${to}${select(toB, { none: "로", rieul: "로", other: "으로" })} 바꿨습니다`;
    }
    case "priority": {
      const from = priorityLabel(Number(e.oldValue));
      const to = priorityLabel(Number(e.newValue));
      const toB = batchim(to);
      return t`우선순위를 ${from} → ${to}${select(toB, { none: "로", rieul: "로", other: "으로" })} 바꿨습니다`;
    }
    case "due": {
      if (!e.newValue) return t`기한을 지웠습니다`;
      const to = e.newValue;
      const toB = batchim(to);
      if (!e.oldValue)
        return t`기한을 ${to}${select(toB, { none: "로", rieul: "로", other: "으로" })} 정했습니다`;
      const from = e.oldValue;
      return t`기한을 ${from} → ${to}${select(toB, { none: "로", rieul: "로", other: "으로" })} 바꿨습니다`;
    }
    case "progress": {
      const from = e.oldValue ?? "0";
      const to = e.newValue ?? "0";
      return t`진행률을 ${from}% → ${to}%로 바꿨습니다`;
    }
    case "comment":
      return t`댓글을 남겼습니다`;
    case "mention": {
      const place = e.commentId ? "comment" : "description";
      if (!e.newValue)
        return t`${select(place, { comment: "댓글에서", other: "설명에서" })} 멘션했습니다`;
      const name = ctx.userName(e.newValue);
      return t`${select(place, { comment: "댓글에서", other: "설명에서" })} ${name}님을 멘션했습니다`;
    }
    case "review_requested":
      return t`완료를 요청했습니다`;
    case "approved":
      return t`승인했습니다`;
    case "rejected":
      return t`반려했습니다`;
    case "reopened":
      return t`다시 열었습니다`;
    case "relation": {
      if (e.field === "parent") {
        if (e.newValue) {
          const to = e.newValue;
          const toB = batchim(to);
          if (e.oldValue) {
            const from = e.oldValue;
            return t`상위 이슈를 ${from} → ${to}${select(toB, { none: "로", rieul: "로", other: "으로" })} 바꿨습니다`;
          }
          return t`상위 이슈를 ${to}${select(toB, { none: "로", rieul: "로", other: "으로" })} 정했습니다`;
        }
        const from = e.oldValue ?? "";
        const fromB = batchim(from);
        return t`상위 이슈 ${from}${select(fromB, { none: "를", other: "을" })} 뺐습니다`;
      }
      const relations = relationLabels();
      const label =
        relations[e.field as keyof typeof relations] ?? e.field ?? "";
      const target = e.newValue ?? e.oldValue ?? "";
      const targetB = batchim(target);
      if (e.newValue)
        return t`${target}${select(targetB, { none: "와", other: "과" })} ''${label}'' 관계를 맺었습니다`;
      return t`${target}${select(targetB, { none: "와", other: "과" })}의 ''${label}'' 관계를 끊었습니다`;
    }
    case "checklist": {
      const item = e.field ?? "";
      const action = e.newValue ?? "";
      return t`체크리스트 ''${item}'' 항목을 ${select(action, {
        added: "추가했습니다",
        removed: "지웠습니다",
        done: "완료로 표시했습니다",
        undone: "완료를 해제했습니다",
        other: "바꿨습니다",
      })}`;
    }
    case "due_soon": {
      const due = e.newValue ?? "";
      return t`기한(${due})이 다가옵니다`;
    }
    case "overdue": {
      const due = e.newValue ?? "";
      return t`기한(${due})이 지났습니다`;
    }
    case "hold_resumed":
      return t`재개일이 되어 보류가 풀렸습니다`;
    case "unblocked": {
      if (e.newValue == null) return t`막던 게시물이 닫혀 차단이 풀렸습니다`;
      const blocker = e.newValue;
      const blockerB = batchim(blocker);
      return t`${blocker}${select(blockerB, { none: "가", other: "이" })} 닫혀 차단이 풀렸습니다`;
    }
    case "children_resolved":
      return t`하위 이슈가 모두 끝나 검토 중이 되었습니다`;
    default: {
      const kind = e.kind;
      return t`${kind} 변경`;
    }
  }
}

/** 문장 전체: 사람이 한 일은 "김지훈님이 …", 시스템 이벤트는 문장만 */
export function eventSentence(e: FeedEvent, ctx: EventTextContext) {
  const text = eventText(e, ctx);
  if (isSystemEvent(e)) return text;
  const actor = ctx.userName(e.actorId);
  return t`${actor}님이 ${text}`;
}

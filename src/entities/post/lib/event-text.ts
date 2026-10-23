// 활동 로그 문장. 변경 이력(FeedEvent) 한 줄을 "김지훈님이 상태를 진행 중 → 검토 중으로 바꿨습니다"처럼 읽는다.

import type {
  FeedEvent,
  PostStatus,
  StatusNames,
} from "@/shared/api/feed/types";
import { priorityLabel, RELATION_LABELS, statusLabel } from "./labels";

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

const CHECKLIST_VERBS: Record<string, string> = {
  added: "추가했습니다",
  removed: "지웠습니다",
  done: "완료로 표시했습니다",
  undone: "완료를 해제했습니다",
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
    s ? statusLabel(s as PostStatus, ctx.statusNames) : "없음";
  const change = (label: string, from: string, to: string) =>
    `${label} ${from} → ${josa(to, "으로/로")} 바꿨습니다`;

  switch (e.kind) {
    case "created":
      return "게시물을 만들었습니다";
    case "status":
      return change("상태를", status(e.oldValue), status(e.newValue));
    case "assignee":
      if (!e.newValue) return "담당자를 비웠습니다";
      if (!e.oldValue)
        return `${ctx.userName(e.newValue)}님을 담당자로 정했습니다`;
      return change(
        "담당자를",
        ctx.userName(e.oldValue),
        ctx.userName(e.newValue),
      );
    case "priority":
      return change(
        "우선순위를",
        priorityLabel(Number(e.oldValue)),
        priorityLabel(Number(e.newValue)),
      );
    case "due":
      if (!e.newValue) return "기한을 지웠습니다";
      if (!e.oldValue)
        return `기한을 ${josa(e.newValue, "으로/로")} 정했습니다`;
      return change("기한을", e.oldValue, e.newValue);
    case "progress":
      return `진행률을 ${e.oldValue ?? 0}% → ${e.newValue ?? 0}%로 바꿨습니다`;
    case "comment":
      return "댓글을 남겼습니다";
    case "mention":
      return "댓글에서 멘션했습니다";
    case "review_requested":
      return "완료를 요청했습니다";
    case "approved":
      return "승인했습니다";
    case "rejected":
      return "반려했습니다";
    case "reopened":
      return "다시 열었습니다";
    case "relation": {
      if (e.field === "parent") {
        if (e.newValue && e.oldValue)
          return change("상위 이슈를", e.oldValue, e.newValue);
        if (e.newValue)
          return `상위 이슈를 ${josa(e.newValue, "으로/로")} 정했습니다`;
        return `상위 이슈 ${josa(e.oldValue ?? "", "을/를")} 뺐습니다`;
      }
      const label =
        RELATION_LABELS[e.field as keyof typeof RELATION_LABELS] ?? e.field;
      if (e.newValue)
        return `${josa(e.newValue, "과/와")} '${label}' 관계를 맺었습니다`;
      return `${josa(e.oldValue ?? "", "과/와")}의 '${label}' 관계를 끊었습니다`;
    }
    case "checklist":
      return `체크리스트 '${e.field ?? ""}' 항목을 ${CHECKLIST_VERBS[e.newValue ?? ""] ?? "바꿨습니다"}`;
    case "due_soon":
      return `기한(${e.newValue ?? ""})이 다가옵니다`;
    case "overdue":
      return `기한(${e.newValue ?? ""})이 지났습니다`;
    case "hold_resumed":
      return "재개일이 되어 보류가 풀렸습니다";
    case "unblocked":
      return `${josa(e.newValue ?? "막던 게시물", "이/가")} 닫혀 차단이 풀렸습니다`;
    case "children_resolved":
      return "하위 이슈가 모두 끝나 검토 중이 되었습니다";
    default:
      return `${e.kind} 변경`;
  }
}

/** 문장 전체: 사람이 한 일은 "김지훈님이 …", 시스템 이벤트는 문장만 */
export function eventSentence(e: FeedEvent, ctx: EventTextContext) {
  const text = eventText(e, ctx);
  return isSystemEvent(e) ? text : `${ctx.userName(e.actorId)}님이 ${text}`;
}

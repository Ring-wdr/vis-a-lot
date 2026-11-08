// 활동 로그 문장. 변경 이력(FeedEvent) 한 줄을 "김지훈님이 상태를 진행 중 → 검토 중으로 바꿨습니다"처럼 읽는다.
// 영어는 "Kim changed status In progress → In review"처럼 이름 뒤에 동사를 붙인다.

import type {
  FeedEvent,
  PostStatus,
  StatusNames,
} from "@/shared/api/feed/types";
import { defineMessages, t } from "@/shared/lib/i18n";
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

type ChecklistAction = "added" | "removed" | "done" | "undone";

const messages = defineMessages({
  ko: {
    none: "없음",
    created: "게시물을 만들었습니다",
    statusChanged: (from: string, to: string) =>
      `상태를 ${from} → ${josa(to, "으로/로")} 바꿨습니다`,
    assigneeCleared: "담당자를 비웠습니다",
    assigneeSet: (name: string) => `${name}님을 담당자로 정했습니다`,
    assigneeChanged: (from: string, to: string) =>
      `담당자를 ${from} → ${josa(to, "으로/로")} 바꿨습니다`,
    priorityChanged: (from: string, to: string) =>
      `우선순위를 ${from} → ${josa(to, "으로/로")} 바꿨습니다`,
    dueCleared: "기한을 지웠습니다",
    dueSet: (due: string) => `기한을 ${josa(due, "으로/로")} 정했습니다`,
    dueChanged: (from: string, to: string) =>
      `기한을 ${from} → ${josa(to, "으로/로")} 바꿨습니다`,
    progressChanged: (from: string, to: string) =>
      `진행률을 ${from}% → ${to}%로 바꿨습니다`,
    commented: "댓글을 남겼습니다",
    mentioned: (inComment: boolean, name?: string) =>
      name
        ? `${inComment ? "댓글에서" : "설명에서"} ${name}님을 멘션했습니다`
        : `${inComment ? "댓글에서" : "설명에서"} 멘션했습니다`,
    reviewRequested: "완료를 요청했습니다",
    approved: "승인했습니다",
    rejected: "반려했습니다",
    reopened: "다시 열었습니다",
    parentChanged: (from: string, to: string) =>
      `상위 이슈를 ${from} → ${josa(to, "으로/로")} 바꿨습니다`,
    parentSet: (to: string) => `상위 이슈를 ${josa(to, "으로/로")} 정했습니다`,
    parentRemoved: (from: string) =>
      `상위 이슈 ${josa(from, "을/를")} 뺐습니다`,
    relationAdded: (target: string, label: string) =>
      `${josa(target, "과/와")} '${label}' 관계를 맺었습니다`,
    relationRemoved: (target: string, label: string) =>
      `${josa(target, "과/와")}의 '${label}' 관계를 끊었습니다`,
    checklist: (item: string, action: string) =>
      `체크리스트 '${item}' 항목을 ${
        {
          added: "추가했습니다",
          removed: "지웠습니다",
          done: "완료로 표시했습니다",
          undone: "완료를 해제했습니다",
        }[action as ChecklistAction] ?? "바꿨습니다"
      }`,
    dueSoon: (due: string) => `기한(${due})이 다가옵니다`,
    overdue: (due: string) => `기한(${due})이 지났습니다`,
    holdResumed: "재개일이 되어 보류가 풀렸습니다",
    unblocked: (blocker?: string) =>
      `${josa(blocker ?? "막던 게시물", "이/가")} 닫혀 차단이 풀렸습니다`,
    childrenResolved: "하위 이슈가 모두 끝나 검토 중이 되었습니다",
    other: (kind: string) => `${kind} 변경`,
    sentence: (actor: string, text: string) => `${actor}님이 ${text}`,
  },
  en: {
    none: "None",
    created: "created the post",
    statusChanged: (from: string, to: string) =>
      `changed status ${from} → ${to}`,
    assigneeCleared: "cleared the assignee",
    assigneeSet: (name: string) => `assigned ${name}`,
    assigneeChanged: (from: string, to: string) =>
      `changed assignee ${from} → ${to}`,
    priorityChanged: (from: string, to: string) =>
      `changed priority ${from} → ${to}`,
    dueCleared: "cleared the due date",
    dueSet: (due: string) => `set the due date to ${due}`,
    dueChanged: (from: string, to: string) =>
      `changed the due date ${from} → ${to}`,
    progressChanged: (from: string, to: string) =>
      `changed progress ${from}% → ${to}%`,
    commented: "left a comment",
    mentioned: (inComment: boolean, name?: string) =>
      `mentioned ${name ? `${name} ` : ""}in ${inComment ? "a comment" : "the description"}`,
    reviewRequested: "requested review",
    approved: "approved",
    rejected: "rejected",
    reopened: "reopened",
    parentChanged: (from: string, to: string) =>
      `changed the parent issue ${from} → ${to}`,
    parentSet: (to: string) => `set the parent issue to ${to}`,
    parentRemoved: (from: string) => `removed parent issue ${from}`,
    relationAdded: (target: string, label: string) =>
      `added a '${label}' relation with ${target}`,
    relationRemoved: (target: string, label: string) =>
      `removed the '${label}' relation with ${target}`,
    checklist: (item: string, action: string) =>
      `${
        {
          added: "added",
          removed: "removed",
          done: "checked off",
          undone: "unchecked",
        }[action as ChecklistAction] ?? "changed"
      } checklist item '${item}'`,
    dueSoon: (due: string) => `Due date (${due}) is approaching`,
    overdue: (due: string) => `Due date (${due}) has passed`,
    holdResumed: "Hold lifted on the resume date",
    unblocked: (blocker?: string) =>
      `Unblocked: ${blocker ?? "the blocking post"} was closed`,
    childrenResolved: "All sub-issues done; moved to review",
    other: (kind: string) => `changed ${kind}`,
    sentence: (actor: string, text: string) => `${actor} ${text}`,
  },
});

/** 행위자 이름을 뺀 문장 (행위자는 따로 굵게 붙인다) */
export function eventText(e: FeedEvent, ctx: EventTextContext): string {
  const text = t(messages);
  const status = (s: string | null) =>
    s ? statusLabel(s as PostStatus, ctx.statusNames) : text.none;

  switch (e.kind) {
    case "created":
      return text.created;
    case "status":
      return text.statusChanged(status(e.oldValue), status(e.newValue));
    case "assignee":
      if (!e.newValue) return text.assigneeCleared;
      if (!e.oldValue) return text.assigneeSet(ctx.userName(e.newValue));
      return text.assigneeChanged(
        ctx.userName(e.oldValue),
        ctx.userName(e.newValue),
      );
    case "priority":
      return text.priorityChanged(
        priorityLabel(Number(e.oldValue)),
        priorityLabel(Number(e.newValue)),
      );
    case "due":
      if (!e.newValue) return text.dueCleared;
      if (!e.oldValue) return text.dueSet(e.newValue);
      return text.dueChanged(e.oldValue, e.newValue);
    case "progress":
      return text.progressChanged(e.oldValue ?? "0", e.newValue ?? "0");
    case "comment":
      return text.commented;
    case "mention":
      return text.mentioned(
        !!e.commentId,
        e.newValue ? ctx.userName(e.newValue) : undefined,
      );
    case "review_requested":
      return text.reviewRequested;
    case "approved":
      return text.approved;
    case "rejected":
      return text.rejected;
    case "reopened":
      return text.reopened;
    case "relation": {
      if (e.field === "parent") {
        if (e.newValue && e.oldValue)
          return text.parentChanged(e.oldValue, e.newValue);
        if (e.newValue) return text.parentSet(e.newValue);
        return text.parentRemoved(e.oldValue ?? "");
      }
      const relations = relationLabels();
      const label =
        relations[e.field as keyof typeof relations] ?? e.field ?? "";
      if (e.newValue) return text.relationAdded(e.newValue, label);
      return text.relationRemoved(e.oldValue ?? "", label);
    }
    case "checklist":
      return text.checklist(e.field ?? "", e.newValue ?? "");
    case "due_soon":
      return text.dueSoon(e.newValue ?? "");
    case "overdue":
      return text.overdue(e.newValue ?? "");
    case "hold_resumed":
      return text.holdResumed;
    case "unblocked":
      return text.unblocked(e.newValue ?? undefined);
    case "children_resolved":
      return text.childrenResolved;
    default:
      return text.other(e.kind);
  }
}

/** 문장 전체: 사람이 한 일은 "김지훈님이 …", 시스템 이벤트는 문장만 */
export function eventSentence(e: FeedEvent, ctx: EventTextContext) {
  const text = eventText(e, ctx);
  return isSystemEvent(e)
    ? text
    : t(messages).sentence(ctx.userName(e.actorId), text);
}

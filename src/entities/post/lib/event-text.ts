// 활동 로그 문장. 변경 이력(FeedEvent) 한 줄을 "김지훈님이 상태를 진행 중 → 검토 중으로 바꿨습니다"처럼 읽는다.
// 영어는 "Kim changed status In progress → In review"처럼 이름 뒤에 동사를 붙인다.

import type {
  FeedEvent,
  PostStatus,
  StatusNames,
} from "@/shared/api/feed/types";
import { intlTranslator } from "@/shared/lib/intl";
import { defineIntlMessages } from "@/shared/lib/intl-messages";
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
// ICU 문구. 한국어 조사는 ICU로 고를 수 없어 조사만 따로 넘긴다 ("{to}{ro}", ro = 조사(to, "으로/로")).
// 영어 문구는 조사 인자를 쓰지 않는다. next-intl은 ko 문구로 인자를 검사하므로 ko가 쓰는 인자가 en보다 많아야 한다
// (en에만 있는 인자를 넘기면 타입 오류). 작은따옴표는 ICU escape라 ''{item}''처럼 두 번 적는다.
const messages = defineIntlMessages({
  ko: {
    none: "없음",
    created: "게시물을 만들었습니다",
    statusChanged: "상태를 {from} → {to}{ro} 바꿨습니다",
    assigneeCleared: "담당자를 비웠습니다",
    assigneeSet: "{name}님을 담당자로 정했습니다",
    assigneeChanged: "담당자를 {from} → {to}{ro} 바꿨습니다",
    priorityChanged: "우선순위를 {from} → {to}{ro} 바꿨습니다",
    dueCleared: "기한을 지웠습니다",
    dueSet: "기한을 {due}{ro} 정했습니다",
    dueChanged: "기한을 {from} → {to}{ro} 바꿨습니다",
    progressChanged: "진행률을 {from}% → {to}%로 바꿨습니다",
    commented: "댓글을 남겼습니다",
    mentioned:
      "{place, select, comment {댓글에서} other {설명에서}} {name}님을 멘션했습니다",
    mentionedNoName:
      "{place, select, comment {댓글에서} other {설명에서}} 멘션했습니다",
    reviewRequested: "완료를 요청했습니다",
    approved: "승인했습니다",
    rejected: "반려했습니다",
    reopened: "다시 열었습니다",
    parentChanged: "상위 이슈를 {from} → {to}{ro} 바꿨습니다",
    parentSet: "상위 이슈를 {to}{ro} 정했습니다",
    parentRemoved: "상위 이슈 {from}{eul} 뺐습니다",
    relationAdded: "{target}{gwa} ''{label}'' 관계를 맺었습니다",
    relationRemoved: "{target}{gwa}의 ''{label}'' 관계를 끊었습니다",
    checklist:
      "체크리스트 ''{item}'' 항목을 {action, select, added {추가했습니다} removed {지웠습니다} done {완료로 표시했습니다} undone {완료를 해제했습니다} other {바꿨습니다}}",
    dueSoon: "기한({due})이 다가옵니다",
    overdue: "기한({due})이 지났습니다",
    holdResumed: "재개일이 되어 보류가 풀렸습니다",
    unblocked: "{blocker}{ga} 닫혀 차단이 풀렸습니다",
    unblockedUnknown: "막던 게시물이 닫혀 차단이 풀렸습니다",
    childrenResolved: "하위 이슈가 모두 끝나 검토 중이 되었습니다",
    other: "{kind} 변경",
    sentence: "{actor}님이 {text}",
  },
  en: {
    none: "None",
    created: "created the post",
    statusChanged: "changed status {from} → {to}",
    assigneeCleared: "cleared the assignee",
    assigneeSet: "assigned {name}",
    assigneeChanged: "changed assignee {from} → {to}",
    priorityChanged: "changed priority {from} → {to}",
    dueCleared: "cleared the due date",
    dueSet: "set the due date to {due}",
    dueChanged: "changed the due date {from} → {to}",
    progressChanged: "changed progress {from}% → {to}%",
    commented: "left a comment",
    mentioned:
      "mentioned {name} in {place, select, comment {a comment} other {the description}}",
    mentionedNoName:
      "mentioned in {place, select, comment {a comment} other {the description}}",
    reviewRequested: "requested review",
    approved: "approved",
    rejected: "rejected",
    reopened: "reopened",
    parentChanged: "changed the parent issue {from} → {to}",
    parentSet: "set the parent issue to {to}",
    parentRemoved: "removed parent issue {from}",
    relationAdded: "added a ''{label}'' relation with {target}",
    relationRemoved: "removed the ''{label}'' relation with {target}",
    checklist:
      "{action, select, added {added} removed {removed} done {checked off} undone {unchecked} other {changed}} checklist item ''{item}''",
    dueSoon: "Due date ({due}) is approaching",
    overdue: "Due date ({due}) has passed",
    holdResumed: "Hold lifted on the resume date",
    unblocked: "Unblocked: {blocker} was closed",
    unblockedUnknown: "Unblocked: the blocking post was closed",
    childrenResolved: "All sub-issues done; moved to review",
    other: "changed {kind}",
    sentence: "{actor} {text}",
  },
});

const translator = intlTranslator(messages);

/** word 뒤에 붙일 조사만 */
const particle = (word: string, pair: Parameters<typeof josa>[1]) =>
  josa(word, pair).slice(word.length);

/** 바뀌기 전·후 값과 바뀐 값 뒤의 조사 (en 문구는 ro를 쓰지 않는다) */
const change = (from: string, to: string) => ({
  from,
  to,
  ro: particle(to, "으로/로"),
});

/** 행위자 이름을 뺀 문장 (행위자는 따로 굵게 붙인다) */
export function eventText(e: FeedEvent, ctx: EventTextContext): string {
  const t = translator();
  const status = (s: string | null) =>
    s ? statusLabel(s as PostStatus, ctx.statusNames) : t("none");

  switch (e.kind) {
    case "created":
      return t("created");
    case "status":
      return t("statusChanged", change(status(e.oldValue), status(e.newValue)));
    case "assignee":
      if (!e.newValue) return t("assigneeCleared");
      if (!e.oldValue)
        return t("assigneeSet", { name: ctx.userName(e.newValue) });
      return t(
        "assigneeChanged",
        change(ctx.userName(e.oldValue), ctx.userName(e.newValue)),
      );
    case "priority":
      return t(
        "priorityChanged",
        change(
          priorityLabel(Number(e.oldValue)),
          priorityLabel(Number(e.newValue)),
        ),
      );
    case "due":
      if (!e.newValue) return t("dueCleared");
      if (!e.oldValue)
        return t("dueSet", {
          due: e.newValue,
          ro: particle(e.newValue, "으로/로"),
        });
      return t("dueChanged", change(e.oldValue, e.newValue));
    case "progress":
      return t("progressChanged", {
        from: e.oldValue ?? "0",
        to: e.newValue ?? "0",
      });
    case "comment":
      return t("commented");
    case "mention": {
      const place = e.commentId ? "comment" : "description";
      return e.newValue
        ? t("mentioned", { place, name: ctx.userName(e.newValue) })
        : t("mentionedNoName", { place });
    }
    case "review_requested":
      return t("reviewRequested");
    case "approved":
      return t("approved");
    case "rejected":
      return t("rejected");
    case "reopened":
      return t("reopened");
    case "relation": {
      if (e.field === "parent") {
        if (e.newValue && e.oldValue)
          return t("parentChanged", change(e.oldValue, e.newValue));
        if (e.newValue)
          return t("parentSet", {
            to: e.newValue,
            ro: particle(e.newValue, "으로/로"),
          });
        const from = e.oldValue ?? "";
        return t("parentRemoved", { from, eul: particle(from, "을/를") });
      }
      const relations = relationLabels();
      const label =
        relations[e.field as keyof typeof relations] ?? e.field ?? "";
      const target = (e.newValue || e.oldValue) ?? "";
      const values = { target, gwa: particle(target, "과/와"), label };
      return e.newValue
        ? t("relationAdded", values)
        : t("relationRemoved", values);
    }
    case "checklist":
      return t("checklist", {
        item: e.field ?? "",
        action: e.newValue ?? "",
      });
    case "due_soon":
      return t("dueSoon", { due: e.newValue ?? "" });
    case "overdue":
      return t("overdue", { due: e.newValue ?? "" });
    case "hold_resumed":
      return t("holdResumed");
    case "unblocked":
      return e.newValue
        ? t("unblocked", {
            blocker: e.newValue,
            ga: particle(e.newValue, "이/가"),
          })
        : t("unblockedUnknown");
    case "children_resolved":
      return t("childrenResolved");
    default:
      return t("other", { kind: e.kind });
  }
}

/** 문장 전체: 사람이 한 일은 "김지훈님이 …", 시스템 이벤트는 문장만 */
export function eventSentence(e: FeedEvent, ctx: EventTextContext) {
  const text = eventText(e, ctx);
  return isSystemEvent(e)
    ? text
    : translator()("sentence", { actor: ctx.userName(e.actorId), text });
}

// 흉내 AI 어댑터. 모델 없이 규칙과 템플릿으로 같은 입력에 늘 같은 출력을 낸다.

import { defineMessages, t } from "@/shared/lib/i18n";
import type {
  ActivityData,
  AiAdapter,
  SuggestedFields,
  SuggestFieldsInput,
  SummarizeInput,
} from "./types";

const messages = defineMessages({
  ko: {
    heading: (group: string, from: string, to: string) =>
      `# ${group} 활동 보고 (${from} ~ ${to})`,
    totals: (total: number, done: number) =>
      `기간 동안 활동 ${total}건, 완료 ${done}건이 있었습니다.`,
    actor: (name: string, items: string) => `- ${name}님: ${items}.`,
    doneHeading: "## 완료한 일",
    noneDone: "- 이번 기간에 완료한 일은 없습니다.",
    assignee: (name: string | null) => (name ? `담당 ${name}` : "담당자 없음"),
    lastComment: (comment: string) => `마지막 댓글: ${comment}`,
    generated: (prompt: string) => `(흉내 응답) ${prompt}`,
  },
  en: {
    heading: (group: string, from: string, to: string) =>
      `# ${group} activity report (${from} – ${to})`,
    totals: (total: number, done: number) =>
      `${total} ${total === 1 ? "activity" : "activities"} and ${done} completed ${done === 1 ? "item" : "items"} in this period.`,
    actor: (name: string, items: string) => `- ${name}: ${items}.`,
    doneHeading: "## Completed",
    noneDone: "- Nothing was completed in this period.",
    assignee: (name: string | null) =>
      name ? `assignee ${name}` : "no assignee",
    lastComment: (comment: string) => `Last comment: ${comment}`,
    generated: (prompt: string) => `(mock response) ${prompt}`,
  },
});

/** 보고 초안 문장들. 줄 하나가 스트리밍 조각 하나다. */
export function draftLines(a: ActivityData): string[] {
  const text = t(messages);
  const lines = [text.heading(a.groupName, a.from, a.to), ""];
  const total = a.days.reduce((n, d) => n + d.entries.length, 0);
  lines.push(text.totals(total, a.completed.length), "");

  for (const day of a.days) {
    if (day.entries.length === 0) continue;
    lines.push(`## ${day.date}`);
    // 담당자(행위자)별로 묶되 처음 나온 순서를 지킨다.
    const byActor = new Map<string, ActivityData["days"][number]["entries"]>();
    for (const e of day.entries) {
      const list = byActor.get(e.actorName) ?? [];
      list.push(e);
      byActor.set(e.actorName, list);
    }
    for (const [actor, entries] of byActor) {
      const items = entries.map((e) =>
        `${e.key} '${e.title}' ${e.text}`.trim(),
      );
      lines.push(text.actor(actor, items.join(", ")));
    }
    lines.push("");
  }

  lines.push(text.doneHeading);
  if (a.completed.length === 0) lines.push(text.noneDone);
  for (const c of a.completed)
    lines.push(`- ${c.key} ${c.title} (${text.assignee(c.assigneeName)})`);
  return lines;
}

const firstParagraph = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find(Boolean) ?? "";

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

export function summarizeMock({
  title,
  bodyText,
  lastComment,
}: SummarizeInput) {
  const first = clip(firstParagraph(bodyText) || title, 200);
  const comment = lastComment?.trim();
  return comment
    ? `${first} ${t(messages).lastComment(clip(comment, 120))}`
    : first;
}

/**
 * 게시물 유형 이름(한국어·영어) → 제목·본문에서 찾을 말. 위에서부터 처음 맞는 규칙을 쓴다.
 * 유형 이름은 그룹이 정한 데이터라 화면 언어와 상관없이 두 이름을 다 찾는다.
 */
const TYPE_RULES: [types: string[], pattern: RegExp][] = [
  [
    ["버그", "bug"],
    /오류|에러|안\s?됨|안\s?돼|안\s?되|버그|깨짐|실패|error|bug|broken|fail/i,
  ],
  [["데이터 요청", "data request"], /요청|추출|뽑아|request|extract/i],
  [["기능", "feature"], /기능|추가|개선|지원|feature|improve|support/i],
  [["질문", "question"], /\?|문의|궁금|어떻게|question|how to/i],
  [["업무 기록", "work log"], /기록|회의|정리|공유|\b(?:meeting|notes|log)\b/i],
];

const PRIORITY_RULES: [priority: number, pattern: RegExp][] = [
  [4, /긴급|급함|asap|당장|urgent/i],
  [3, /중요|빨리|오늘\s?까지|important|\bby today\b/i],
];

export function suggestFieldsMock({
  title,
  body,
  postTypes,
  users,
}: SuggestFieldsInput): SuggestedFields {
  const text = `${title}\n${body}`;
  const result: SuggestedFields = {};

  for (const [names, pattern] of TYPE_RULES) {
    if (!pattern.test(text)) continue;
    const type = postTypes.find((p) =>
      names.includes(p.name.trim().toLowerCase()),
    );
    if (type) {
      result.postTypeId = type.id;
      break;
    }
  }

  const priority = PRIORITY_RULES.find(([, p]) => p.test(text))?.[0];
  if (priority !== undefined) result.priority = priority;

  // 본문에 이름(또는 @이름)이 나온 사용자를 담당자로. 긴 이름부터 맞춰 부분 일치를 피한다.
  const named = [...users]
    .sort((a, b) => b.name.length - a.name.length)
    .find((u) => u.name && text.includes(u.name));
  if (named) result.assigneeId = named.id;

  return result;
}

/** JSON 스키마에서 가장 단순한 값을 만든다 (enum은 첫 값). */
export function sampleFromSchema(schema: Record<string, unknown>): unknown {
  if (Array.isArray(schema.enum)) return schema.enum[0] ?? null;
  if ("const" in schema) return schema.const;
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "object": {
      const props = (schema.properties ?? {}) as Record<
        string,
        Record<string, unknown>
      >;
      return Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, sampleFromSchema(v)]),
      );
    }
    case "array":
      return [];
    case "string":
      return "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}

export const mockAdapter: AiAdapter = {
  async *draftReport(activity, opts) {
    for (const line of draftLines(activity)) {
      if (opts?.signal?.aborted) return;
      yield `${line}\n`;
    }
  },
  summarize: async (post) => summarizeMock(post),
  suggestFields: async (input) => suggestFieldsMock(input),
  generate: async (prompt, opts) =>
    opts?.schema
      ? JSON.stringify(sampleFromSchema(opts.schema))
      : t(messages).generated(clip(prompt.trim(), 80)),
};

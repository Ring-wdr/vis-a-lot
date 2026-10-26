// 흉내 AI 어댑터. 모델 없이 규칙과 템플릿으로 같은 입력에 늘 같은 출력을 낸다.

import type {
  ActivityData,
  AiAdapter,
  SuggestedFields,
  SuggestFieldsInput,
  SummarizeInput,
} from "./types";

/** 보고 초안 문장들. 줄 하나가 스트리밍 조각 하나다. */
export function draftLines(a: ActivityData): string[] {
  const lines = [`# ${a.groupName} 활동 보고 (${a.from} ~ ${a.to})`, ""];
  const total = a.days.reduce((n, d) => n + d.entries.length, 0);
  lines.push(
    `기간 동안 활동 ${total}건, 완료 ${a.completed.length}건이 있었습니다.`,
    "",
  );

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
      lines.push(`- ${actor}님: ${items.join(", ")}.`);
    }
    lines.push("");
  }

  lines.push("## 완료한 일");
  if (a.completed.length === 0)
    lines.push("- 이번 기간에 완료한 일은 없습니다.");
  for (const c of a.completed)
    lines.push(
      `- ${c.key} ${c.title} (${c.assigneeName ? `담당 ${c.assigneeName}` : "담당자 없음"})`,
    );
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
  return comment ? `${first} 마지막 댓글: ${clip(comment, 120)}` : first;
}

/** 게시물 유형 이름 → 제목·본문에서 찾을 말. 위에서부터 처음 맞는 규칙을 쓴다. */
const TYPE_RULES: [type: string, pattern: RegExp][] = [
  ["버그", /오류|에러|안\s?됨|안\s?돼|안\s?되|버그|깨짐|실패|error|bug/i],
  ["데이터 요청", /요청|추출|뽑아/],
  ["기능", /기능|추가|개선|지원/],
  ["질문", /\?|문의|궁금|어떻게/],
  ["업무 기록", /기록|회의|정리|공유/],
];

const PRIORITY_RULES: [priority: number, pattern: RegExp][] = [
  [4, /긴급|급함|asap|당장/i],
  [3, /중요|빨리|오늘\s?까지/],
];

export function suggestFieldsMock({
  title,
  body,
  postTypes,
  users,
}: SuggestFieldsInput): SuggestedFields {
  const text = `${title}\n${body}`;
  const result: SuggestedFields = {};

  for (const [name, pattern] of TYPE_RULES) {
    if (!pattern.test(text)) continue;
    const type = postTypes.find((t) => t.name === name);
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
      : `(흉내 응답) ${clip(prompt.trim(), 80)}`,
};

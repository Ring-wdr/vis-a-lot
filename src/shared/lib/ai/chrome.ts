// Chrome 내장 AI(Prompt API) 어댑터. 세션은 index.ts가 만들어 넘기고, 실패 처리(흉내로 내려가기)도 index.ts가 한다.

import { defineMessages, getLocale, type Locale, t } from "@/shared/lib/i18n";
import type {
  ActivityData,
  SuggestedFields,
  SuggestFieldsInput,
  SummarizeInput,
} from "./types";

const messages = defineMessages({
  ko: {
    system:
      "너는 사내 이슈 트래커의 업무 보조다. 항상 한국어로, 사실만 간결하게 쓴다. 입력에 없는 내용은 지어내지 않는다.",
    assignee: (name: string | null) => `담당 ${name ?? "없음"}`,
    draft: (group: string, from: string, to: string) =>
      `${group} 그룹의 ${from} ~ ${to} 활동 보고 초안을 써라.`,
    draftRule:
      "날짜순으로, 같은 날은 사람별로 묶어 한두 문장씩 쓰고, 마지막에 완료한 일을 목록으로 정리한다.",
    log: "[활동 로그]",
    done: "[완료]",
    none: "(없음)",
    summarize: "다음 게시물을 두 문장 이내로 요약하라.",
    title: "제목",
    body: "본문",
    lastComment: "마지막 댓글",
    suggest:
      "새 게시물의 유형·우선순위(0 없음 ~ 4 긴급)·담당자를 추천하라. 모르면 빈 문자열이나 0을 쓴다.",
    types: "유형",
    users: "사용자",
  },
  en: {
    system:
      "You are an assistant for an internal issue tracker. Always write in English, stating only facts, concisely. Do not invent anything that is not in the input.",
    assignee: (name: string | null) => `assignee ${name ?? "none"}`,
    draft: (group: string, from: string, to: string) =>
      `Write a draft activity report for the ${group} group from ${from} to ${to}.`,
    draftRule:
      "Go in date order; within a day, group by person with one or two sentences each, and finish with a list of completed work.",
    log: "[Activity log]",
    done: "[Completed]",
    none: "(none)",
    summarize: "Summarize the following post in at most two sentences.",
    title: "Title",
    body: "Body",
    lastComment: "Last comment",
    suggest:
      "Suggest the type, priority (0 none to 4 urgent) and assignee for a new post. If unsure, use an empty string or 0.",
    types: "Types",
    users: "Users",
  },
});

/** 지금 화면 언어로 입출력한다고 알린다. */
export function languageOptions(locale: Locale = getLocale()) {
  const languages = [{ type: "text" as const, languages: [locale] }];
  return {
    expectedInputs: languages,
    expectedOutputs: languages,
  } satisfies LanguageModelCreateCoreOptions;
}

/** 지금 화면 언어의 시스템 프롬프트 */
export const systemPrompt = (locale: Locale = getLocale()) =>
  messages[locale].system;

export const hasLanguageModel = () => typeof LanguageModel !== "undefined";

export function draftPrompt(a: ActivityData) {
  const text = t(messages);
  const days = a.days
    .map(
      (d) =>
        `${d.date}\n${d.entries
          .map(
            (e) =>
              `- ${e.actorName}: ${e.key} ${e.title} (${e.kind}) ${e.text}`,
          )
          .join("\n")}`,
    )
    .join("\n");
  const done = a.completed
    .map((c) => `- ${c.key} ${c.title} (${text.assignee(c.assigneeName)})`)
    .join("\n");
  return [
    text.draft(a.groupName, a.from, a.to),
    text.draftRule,
    "",
    text.log,
    days || text.none,
    "",
    text.done,
    done || text.none,
  ].join("\n");
}

export function summarizePrompt(p: SummarizeInput) {
  const text = t(messages);
  return [
    text.summarize,
    `${text.title}: ${p.title}`,
    `${text.body}: ${p.bodyText}`,
    p.lastComment ? `${text.lastComment}: ${p.lastComment}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** suggestFields 출력을 고정하는 JSON 스키마. 고를 수 있는 id만 enum으로 준다. */
export function suggestSchema(input: SuggestFieldsInput) {
  const ids = (list: { id: string }[]) => [...list.map((x) => x.id), ""];
  return {
    type: "object",
    properties: {
      postTypeId: { type: "string", enum: ids(input.postTypes) },
      priority: { type: "integer", minimum: 0, maximum: 4 },
      assigneeId: { type: "string", enum: ids(input.users) },
    },
    required: ["postTypeId", "priority", "assigneeId"],
    additionalProperties: false,
  };
}

export function suggestPrompt(input: SuggestFieldsInput) {
  const text = t(messages);
  return [
    text.suggest,
    `${text.types}: ${input.postTypes.map((p) => `${p.id}=${p.name}`).join(", ")}`,
    `${text.users}: ${input.users.map((u) => `${u.id}=${u.name}`).join(", ")}`,
    `${text.title}: ${input.title}`,
    `${text.body}: ${input.body}`,
  ].join("\n");
}

/** 모델 출력에서 고를 수 있는 값만 남긴다. */
export function parseSuggestion(
  raw: string,
  input: SuggestFieldsInput,
): SuggestedFields {
  const v = JSON.parse(raw) as Record<string, unknown>;
  const out: SuggestedFields = {};
  if (input.postTypes.some((t) => t.id === v.postTypeId))
    out.postTypeId = v.postTypeId as string;
  if (Number.isInteger(v.priority) && (v.priority as number) > 0)
    out.priority = Math.min(4, v.priority as number);
  if (input.users.some((u) => u.id === v.assigneeId))
    out.assigneeId = v.assigneeId as string;
  return out;
}

/** ReadableStream<string>을 async iterable로 */
export async function* readStream(stream: ReadableStream<string>) {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

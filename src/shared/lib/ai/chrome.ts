// Chrome 내장 AI(Prompt API) 어댑터. 세션은 index.ts가 만들어 넘기고, 실패 처리(흉내로 내려가기)도 index.ts가 한다.

import { msg, t } from "@lingui/core/macro";
import { getLocale, type Locale, linguiFor } from "@/shared/lib/i18n";
import "@/shared/config/messages";
import type {
  ActivityData,
  SuggestedFields,
  SuggestFieldsInput,
  SummarizeInput,
} from "./types";

const SYSTEM_PROMPT = msg`너는 사내 이슈 트래커의 업무 보조다. 항상 한국어로, 사실만 간결하게 쓴다. 입력에 없는 내용은 지어내지 않는다.`;

/** 프롬프트에서 비어 있는 목록 자리 */
const noneText = () => t({ message: "(없음)", context: "AI prompt" });

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
  linguiFor(locale)._(SYSTEM_PROMPT);

export const hasLanguageModel = () => typeof LanguageModel !== "undefined";

export function draftPrompt(a: ActivityData) {
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
    .map((c) => {
      const name = c.assigneeName;
      const assignee = name
        ? t({ message: `담당 ${name}`, comment: "name은 담당자 이름" })
        : t`담당 없음`;
      return `- ${c.key} ${c.title} (${assignee})`;
    })
    .join("\n");
  const { groupName: group, from, to } = a;
  return [
    t`${group} 그룹의 ${from} ~ ${to} 활동 보고 초안을 써라.`,
    t`날짜순으로, 같은 날은 사람별로 묶어 한두 문장씩 쓰고, 마지막에 완료한 일을 목록으로 정리한다.`,
    "",
    t`[활동 로그]`,
    days || noneText(),
    "",
    t`[완료]`,
    done || noneText(),
  ].join("\n");
}

export function summarizePrompt(p: SummarizeInput) {
  const { title, bodyText: body, lastComment } = p;
  return [
    t`다음 게시물을 두 문장 이내로 요약하라.`,
    t`제목: ${title}`,
    t`본문: ${body}`,
    lastComment ? t`마지막 댓글: ${lastComment}` : "",
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
  const types = input.postTypes.map((p) => `${p.id}=${p.name}`).join(", ");
  const users = input.users.map((u) => `${u.id}=${u.name}`).join(", ");
  const { title, body } = input;
  return [
    t`새 게시물의 유형·우선순위(0 없음 ~ 4 긴급)·담당자를 추천하라. 모르면 빈 문자열이나 0을 쓴다.`,
    t({ message: `유형: ${types}`, comment: "types는 id=이름 목록" }),
    t({ message: `사용자: ${users}`, comment: "users는 id=이름 목록" }),
    t`제목: ${title}`,
    t`본문: ${body}`,
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

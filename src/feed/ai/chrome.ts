// Chrome 내장 AI(Prompt API) 어댑터. 세션은 index.ts가 만들어 넘기고, 실패 처리(흉내로 내려가기)도 index.ts가 한다.

import type {
  ActivityData,
  SuggestedFields,
  SuggestFieldsInput,
  SummarizeInput,
} from "./types";

export const KO = [{ type: "text" as const, languages: ["ko"] }];

export const LANGUAGE_OPTIONS = {
  expectedInputs: KO,
  expectedOutputs: KO,
} satisfies LanguageModelCreateCoreOptions;

export const SYSTEM_PROMPT =
  "너는 사내 이슈 트래커의 업무 보조다. 항상 한국어로, 사실만 간결하게 쓴다. 입력에 없는 내용은 지어내지 않는다.";

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
    .map((c) => `- ${c.key} ${c.title} (담당 ${c.assigneeName ?? "없음"})`)
    .join("\n");
  return [
    `${a.groupName} 그룹의 ${a.from} ~ ${a.to} 활동 보고 초안을 써라.`,
    "날짜순으로, 같은 날은 사람별로 묶어 한두 문장씩 쓰고, 마지막에 완료한 일을 목록으로 정리한다.",
    "",
    "[활동 로그]",
    days || "(없음)",
    "",
    "[완료]",
    done || "(없음)",
  ].join("\n");
}

export function summarizePrompt(p: SummarizeInput) {
  return [
    "다음 게시물을 두 문장 이내로 요약하라.",
    `제목: ${p.title}`,
    `본문: ${p.bodyText}`,
    p.lastComment ? `마지막 댓글: ${p.lastComment}` : "",
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
  return [
    "새 게시물의 유형·우선순위(0 없음 ~ 4 긴급)·담당자를 추천하라. 모르면 빈 문자열이나 0을 쓴다.",
    `유형: ${input.postTypes.map((t) => `${t.id}=${t.name}`).join(", ")}`,
    `사용자: ${input.users.map((u) => `${u.id}=${u.name}`).join(", ")}`,
    `제목: ${input.title}`,
    `본문: ${input.body}`,
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

// AI 어댑터 계약. chrome(Chrome 내장 Prompt API)과 mock(결정적 흉내)이 같은 모양을 따른다.

/** 활동 보고 초안의 재료: 기간 안의 활동 로그를 날짜별로, 그리고 완료한 일 */
export type ActivityData = {
  from: string;
  to: string;
  groupName: string;
  days: {
    date: string;
    entries: {
      actorName: string;
      key: string;
      title: string;
      kind: string;
      text: string;
    }[];
  }[];
  completed: { key: string; title: string; assigneeName: string | null }[];
};

export type SummarizeInput = {
  title: string;
  bodyText: string;
  lastComment?: string;
};

export type SuggestFieldsInput = {
  title: string;
  body: string;
  postTypes: { id: string; name: string }[];
  users: { id: string; name: string }[];
};

export type SuggestedFields = {
  postTypeId?: string;
  priority?: number;
  assigneeId?: string;
};

export type GenerateOptions = {
  /** 있으면 이 JSON 스키마에 맞는 JSON 문자열을 돌려준다. */
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type DraftOptions = { signal?: AbortSignal };

export type AiAdapter = {
  draftReport(
    activity: ActivityData,
    opts?: DraftOptions,
  ): AsyncIterable<string>;
  summarize(post: SummarizeInput): Promise<string>;
  suggestFields(input: SuggestFieldsInput): Promise<SuggestedFields>;
  generate(prompt: string, opts?: GenerateOptions): Promise<string>;
};

export type AdapterName = "chrome" | "mock";

export type AiStatus = {
  adapter: AdapterName;
  /** LanguageModel.availability() 값. 전역 LanguageModel이 없으면 "unsupported", 확인 전이면 "checking" */
  availability: string;
};

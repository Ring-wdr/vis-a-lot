// 피드 AI. Chrome 내장 AI가 쓸 수 있으면 chrome, 아니면 흉내(mock) 어댑터로 같은 함수를 제공한다.
// chrome에서 create·prompt가 실패하면(한국어 NotSupportedError 등) 이 세션 동안 흉내로 내려가고 구독자에게 알린다.

import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { getLocale, type Locale } from "@/shared/lib/i18n";
import {
  draftPrompt,
  hasLanguageModel,
  languageOptions,
  parseSuggestion,
  readStream,
  suggestPrompt,
  suggestSchema,
  summarizePrompt,
  systemPrompt,
} from "./chrome";
import { mockAdapter } from "./mock";
import type {
  ActivityData,
  AiStatus,
  DraftOptions,
  GenerateOptions,
  SuggestedFields,
  SuggestFieldsInput,
  SummarizeInput,
} from "./types";

export type * from "./types";

type AiState = AiStatus & {
  /** 다운로드 진행률 0~1. 받는 중이 아니면 null */
  progress: number | null;
  /** chrome에서 흉내로 내려간 이유 */
  failure: string | null;
};

export const aiStore = createStore<AiState>(() => ({
  adapter: "mock",
  availability: "checking",
  progress: null,
  failure: null,
}));

export const useAiStatus = () => useStore(aiStore);

let detecting: Promise<AiStatus> | null = null;

/** 지금 어댑터와 availability. 처음 부를 때 한 번 확인한다. */
export function status(): Promise<AiStatus> {
  detecting ??= (async () => {
    if (!hasLanguageModel()) {
      aiStore.setState({ adapter: "mock", availability: "unsupported" });
    } else {
      try {
        const availability = await LanguageModel.availability(
          languageOptions(),
        );
        aiStore.setState({
          availability,
          adapter: availability === "available" ? "chrome" : "mock",
        });
      } catch (err) {
        aiStore.setState({
          adapter: "mock",
          availability: "error",
          failure: message(err),
        });
      }
    }
    const { adapter, availability } = aiStore.getState();
    return { adapter, availability };
  })();
  return detecting;
}

const message = (err: unknown) =>
  err instanceof Error ? `${err.name}: ${err.message}` : String(err);

let base: Promise<LanguageModel> | null = null;
/** base 세션을 만든 화면 언어. 언어가 바뀌면 그 언어의 시스템 프롬프트로 다시 만든다. */
let baseLocale: Locale | null = null;

function createBase(monitor?: CreateMonitorCallback) {
  const locale = getLocale();
  if (baseLocale !== locale) base = null;
  baseLocale = locale;
  base ??= LanguageModel.create({
    ...languageOptions(locale),
    initialPrompts: [{ role: "system", content: systemPrompt(locale) }],
    monitor,
  }).catch((err) => {
    base = null;
    throw err;
  });
  return base;
}

/** 이 세션은 흉내로 내려간다. */
function fallBack(err: unknown) {
  base = null;
  aiStore.setState({ adapter: "mock", progress: null, failure: message(err) });
}

/**
 * downloadable이면 모델을 내려받아 chrome으로 바꾼다. 성공하면 true.
 * 이미 chrome이면 바로 true, 쓸 수 없으면 false.
 */
export async function ensureChrome({
  onProgress,
}: {
  onProgress?: (loaded: number) => void;
} = {}): Promise<boolean> {
  await status();
  const s = aiStore.getState();
  if (s.adapter === "chrome") return true;
  if (!hasLanguageModel() || s.failure) return false;
  if (s.availability !== "downloadable" && s.availability !== "available")
    return false;
  aiStore.setState({ progress: 0 });
  try {
    await createBase((m) => {
      m.addEventListener("downloadprogress", (e) => {
        aiStore.setState({ progress: e.loaded });
        onProgress?.(e.loaded);
      });
    });
    aiStore.setState({
      adapter: "chrome",
      availability: "available",
      progress: null,
    });
    return true;
  } catch (err) {
    fallBack(err);
    return false;
  }
}

/** chrome이면 base 세션을 복제해 fn을 돌리고, 실패하면 흉내로 내려가 fallback을 돌린다. */
async function withChrome<T>(
  fn: (session: LanguageModel) => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  await status();
  if (aiStore.getState().adapter !== "chrome") return fallback();
  let session: LanguageModel | undefined;
  try {
    session = await (await createBase()).clone();
    return await fn(session);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    fallBack(err);
    return fallback();
  } finally {
    session?.destroy();
  }
}

/** 활동 보고 초안을 조각으로 흘려준다. 첫 조각 전에 chrome이 실패하면 흉내 초안으로 이어 간다. */
export async function* draftReport(
  activity: ActivityData,
  opts?: DraftOptions,
): AsyncIterable<string> {
  await status();
  if (aiStore.getState().adapter === "chrome") {
    let session: LanguageModel | undefined;
    let yielded = false;
    try {
      session = await (await createBase()).clone();
      const stream = session.promptStreaming(draftPrompt(activity), {
        signal: opts?.signal,
      });
      for await (const chunk of readStream(stream)) {
        yielded = true;
        yield chunk;
      }
      return;
    } catch (err) {
      if (opts?.signal?.aborted) return;
      fallBack(err);
      if (yielded) throw err;
    } finally {
      session?.destroy();
    }
  }
  yield* mockAdapter.draftReport(activity, opts);
}

export const summarize = (post: SummarizeInput): Promise<string> =>
  withChrome(
    (s) => s.prompt(summarizePrompt(post)),
    () => mockAdapter.summarize(post),
  );

export const suggestFields = (
  input: SuggestFieldsInput,
): Promise<SuggestedFields> =>
  withChrome(
    async (s) =>
      parseSuggestion(
        await s.prompt(suggestPrompt(input), {
          responseConstraint: suggestSchema(input),
        }),
        input,
      ),
    () => mockAdapter.suggestFields(input),
  );

export const generate = (
  prompt: string,
  opts?: GenerateOptions,
): Promise<string> =>
  withChrome(
    (s) =>
      s.prompt(prompt, {
        responseConstraint: opts?.schema,
        signal: opts?.signal,
      }),
    () => mockAdapter.generate(prompt, opts),
  );

export const ai = {
  status,
  ensureChrome,
  draftReport,
  summarize,
  suggestFields,
  generate,
};

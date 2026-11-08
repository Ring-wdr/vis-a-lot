"use client";

import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { ensureChrome, status, useAiStatus } from "@/shared/lib/ai";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import { StableText } from "@/shared/ui/StableText";
import { button } from "./button";
import { Popover } from "./Popover";

const messages = defineMessages({
  ko: {
    adapter: { chrome: "Chrome 내장 AI", mock: "흉내" },
    adapterTitle: (name: string) => `AI 어댑터: ${name}`,
    fallbackReason: "흉내로 바꾼 이유",
    downloading: "내려받는 중",
    download: "모델 다운로드",
    chromeNote: "보고 초안·요약·필드 추천을 브라우저 안의 모델이 만듭니다.",
    mockNote: "모델 없이 규칙과 템플릿으로 같은 기능을 흉내 냅니다.",
  },
  en: {
    adapter: { chrome: "Chrome AI", mock: "Mock" },
    adapterTitle: (name: string) => `AI adapter: ${name}`,
    fallbackReason: "Why it fell back to mock",
    downloading: "Downloading",
    download: "Download model",
    chromeNote:
      "A model in your browser writes report drafts, summaries and field suggestions.",
    mockNote: "Mimics the same features with rules and templates, no model.",
  },
});

/** 상단 바의 AI 어댑터 배지. 누르면 availability와, 내려받을 수 있으면 다운로드 버튼을 보여준다. */
export function AiBadge() {
  const text = useT(messages);
  const { adapter, availability, progress, failure } = useAiStatus();
  const adapterLabel = text.adapter[adapter];

  useEffect(() => {
    void status();
  }, []);

  const downloading = progress !== null;
  return (
    <Popover
      triggerClassName={cn(
        "inline-flex h-7 flex-none cursor-pointer items-center gap-1 rounded-full border border-line bg-panel px-2.5 text-xs whitespace-nowrap text-fg-secondary",
        adapter === "chrome" && "border-accent-line bg-accent-soft text-accent",
      )}
      triggerLabel={text.adapterTitle(adapterLabel)}
      width={280}
      trigger={
        <>
          <Sparkles size={13} aria-hidden="true" />
          <StableText
            ko={messages.ko.adapter[adapter]}
            en={messages.en.adapter[adapter]}
          />
        </>
      }
    >
      {() => (
        <div className="flex flex-col gap-2 text-ui">
          <p className="font-semibold">{text.adapterTitle(adapterLabel)}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-fg-muted">availability</dt>
            <dd className="font-mono">{availability}</dd>
            {failure && (
              <>
                <dt className="text-fg-muted">{text.fallbackReason}</dt>
                <dd className="break-all text-danger">{failure}</dd>
              </>
            )}
          </dl>
          {adapter === "mock" &&
            availability === "downloadable" &&
            !failure && (
              <>
                <button
                  type="button"
                  className={button({ variant: "primary", size: "sm" })}
                  disabled={downloading}
                  onClick={() => ensureChrome()}
                >
                  {downloading ? text.downloading : text.download}
                </button>
                {downloading && (
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-panel-strong"
                    role="progressbar"
                    aria-label={text.download}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                  >
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                )}
              </>
            )}
          <p className="text-xs text-fg-muted">
            {adapter === "chrome" ? text.chromeNote : text.mockNote}
          </p>
        </div>
      )}
    </Popover>
  );
}

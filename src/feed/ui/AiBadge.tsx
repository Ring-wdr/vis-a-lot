"use client";

import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/shared/lib/tw";
import { button } from "@/shared/ui/button";
import { Popover } from "@/shared/ui/Popover";
import { ensureChrome, status, useAiStatus } from "../ai";

const ADAPTER_LABEL = { chrome: "Chrome 내장 AI", mock: "흉내" } as const;

/** 상단 바의 AI 어댑터 배지. 누르면 availability와, 내려받을 수 있으면 다운로드 버튼을 보여준다. */
export function AiBadge() {
  const { adapter, availability, progress, failure } = useAiStatus();

  useEffect(() => {
    status();
  }, []);

  const downloading = progress !== null;
  return (
    <Popover
      triggerClassName={cn(
        "inline-flex h-7 flex-none cursor-pointer items-center gap-1 rounded-full border border-line bg-panel px-2.5 text-xs whitespace-nowrap text-fg-secondary",
        adapter === "chrome" && "border-accent-line bg-accent-soft text-accent",
      )}
      triggerLabel={`AI 어댑터: ${ADAPTER_LABEL[adapter]}`}
      width={280}
      trigger={
        <>
          <Sparkles size={13} aria-hidden="true" />
          {ADAPTER_LABEL[adapter]}
        </>
      }
    >
      {() => (
        <div className="flex flex-col gap-2 text-ui">
          <p className="font-semibold">AI 어댑터: {ADAPTER_LABEL[adapter]}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-fg-muted">availability</dt>
            <dd className="font-mono">{availability}</dd>
            {failure && (
              <>
                <dt className="text-fg-muted">흉내로 바꾼 이유</dt>
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
                  {downloading ? "내려받는 중" : "모델 다운로드"}
                </button>
                {downloading && (
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-panel-strong"
                    role="progressbar"
                    aria-label="모델 다운로드"
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
            {adapter === "chrome"
              ? "보고 초안·요약·필드 추천을 브라우저 안의 모델이 만듭니다."
              : "모델 없이 규칙과 템플릿으로 같은 기능을 흉내 냅니다."}
          </p>
        </div>
      )}
    </Popover>
  );
}

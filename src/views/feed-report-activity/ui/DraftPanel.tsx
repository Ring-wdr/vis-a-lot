"use client";

// 보고 초안: 활동 보고를 AI 어댑터(draftReport)로 흘려받아 고칠 수 있는 글상자에 채운다. 멈추기·다시 만들기·복사.

import { Copy, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ai, useAiStatus } from "@/shared/lib/ai";
import type { ActivityData } from "@/shared/lib/ai/types";
import { cn } from "@/shared/lib/tw";
import { button, toolButton } from "@/shared/ui/button";

const ADAPTER_LABEL = { chrome: "Chrome 내장 AI", mock: "흉내" } as const;

type DraftState = "streaming" | "done" | "stopped" | "error";

const STATE_LABEL: Record<DraftState, string> = {
  streaming: "쓰는 중…",
  done: "다 썼습니다",
  stopped: "멈췄습니다",
  error: "초안을 만들지 못했습니다",
};

/** 초안을 흘려받는다. 중간에 멈추면(ctrl.abort) 받은 데까지 두고 끝낸다. */
async function streamDraft(
  data: ActivityData,
  ctrl: AbortController,
  on: {
    onChunk: (chunk: string) => void;
    onEnd: (state: DraftState, error: string | null) => void;
  },
) {
  try {
    for await (const chunk of ai.draftReport(data, { signal: ctrl.signal })) {
      if (ctrl.signal.aborted) break;
      on.onChunk(chunk);
    }
    on.onEnd(ctrl.signal.aborted ? "stopped" : "done", null);
  } catch (e) {
    if (ctrl.signal.aborted) on.onEnd("stopped", null);
    else on.onEnd("error", e instanceof Error ? e.message : String(e));
  }
}

export function DraftPanel({
  data,
  onClose,
}: {
  /** 열 때의 보고 내용. 다시 만들기도 이 내용으로 한다 */
  data: ActivityData;
  onClose: () => void;
}) {
  const { adapter } = useAiStatus();
  const [text, setText] = useState("");
  const [state, setState] = useState<DraftState>("streaming");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);
  // 흘려받기 한 번. 다시 만들기나 보고 내용이 바뀌면 새 요청 객체가 되어 effect가 다시 흘려받는다.
  const [request, setRequest] = useState({ data });
  const start = (next: ActivityData) => {
    setRequest({ data: next });
    setText("");
    setError(null);
    setState("streaming");
  };
  if (request.data !== data) start(data);

  useEffect(() => {
    // 다음 실행으로 넘어간 뒤 끝난 이전 실행은 화면을 건드리지 않는다.
    let alive = true;
    const ctrl = new AbortController();
    abort.current = ctrl;
    void streamDraft(request.data, ctrl, {
      onChunk: (chunk) => alive && setText((t) => t + chunk),
      onEnd: (next, message) => {
        if (!alive) return;
        setState(next);
        setError(message);
      },
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [request]);

  function stop() {
    abort.current?.abort();
    setState("stopped");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const streaming = state === "streaming";
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-accent-line bg-elevated p-4"
      aria-label="보고 초안"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles size={15} aria-hidden="true" className="text-accent" />
          보고 초안
        </h2>
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-full border border-line bg-panel px-2 text-2xs text-fg-secondary",
            adapter === "chrome" &&
              "border-accent-line bg-accent-soft text-accent",
          )}
          title="초안을 쓰는 AI 어댑터"
        >
          {ADAPTER_LABEL[adapter]}
        </span>
        <span
          data-state={state}
          className="text-xs text-fg-muted data-[state=error]:text-danger"
          aria-live="polite"
        >
          {STATE_LABEL[state]}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {streaming ? (
            <button
              type="button"
              className={button({ size: "sm" })}
              onClick={stop}
            >
              <Square size={13} aria-hidden="true" />
              멈추기
            </button>
          ) : (
            <button
              type="button"
              className={button({ size: "sm" })}
              onClick={() => start(data)}
            >
              <RotateCcw size={13} aria-hidden="true" />
              다시 만들기
            </button>
          )}
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={!text || streaming}
            onClick={copy}
          >
            <Copy size={13} aria-hidden="true" />
            {copied ? "복사했습니다" : "복사"}
          </button>
          <button
            type="button"
            className={toolButton()}
            aria-label="초안 닫기"
            onClick={onClose}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <textarea
        className="min-h-80 w-full resize-y rounded-md border border-line bg-surface p-3 font-mono text-ui/6 text-fg"
        value={text}
        readOnly={streaming}
        aria-busy={streaming}
        aria-label="초안 내용 (고칠 수 있습니다)"
        placeholder={streaming ? "초안을 쓰는 중입니다" : ""}
        onChange={(e) => setText(e.currentTarget.value)}
      />
    </section>
  );
}

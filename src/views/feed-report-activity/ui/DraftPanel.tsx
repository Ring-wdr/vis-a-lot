"use client";

// 보고 초안: 활동 보고를 AI 어댑터(draftReport)로 흘려받아 고칠 수 있는 글상자에 채운다. 멈추기·다시 만들기·복사.

import { Copy, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

  const run = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setText("");
    setError(null);
    setState("streaming");
    try {
      for await (const chunk of ai.draftReport(data, { signal: ctrl.signal })) {
        if (ctrl.signal.aborted) break;
        setText((t) => t + chunk);
      }
      if (abort.current === ctrl)
        setState(ctrl.signal.aborted ? "stopped" : "done");
    } catch (e) {
      if (abort.current !== ctrl) return;
      if (ctrl.signal.aborted) setState("stopped");
      else {
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    }
  }, [data]);

  useEffect(() => {
    run();
    return () => abort.current?.abort();
  }, [run]);

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
              onClick={run}
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

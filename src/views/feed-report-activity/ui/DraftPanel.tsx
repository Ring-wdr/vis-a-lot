"use client";

// 보고 초안: 활동 보고를 AI 어댑터(draftReport)로 흘려받아 고칠 수 있는 글상자에 채운다. 멈추기·다시 만들기·복사.

import { Copy, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ai, useAiStatus } from "@/shared/lib/ai";
import type { ActivityData } from "@/shared/lib/ai/types";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import { button, toolButton } from "@/shared/ui/button";

type DraftState = "streaming" | "done" | "stopped" | "error";

const messages = defineMessages({
  ko: {
    adapter: { chrome: "Chrome 내장 AI", mock: "흉내" },
    state: {
      streaming: "쓰는 중…",
      done: "다 썼습니다",
      stopped: "멈췄습니다",
      error: "초안을 만들지 못했습니다",
    } as Record<DraftState, string>,
    region: "보고 초안",
    title: "보고 초안",
    adapterTitle: "초안을 쓰는 AI 어댑터",
    stop: "멈추기",
    regenerate: "다시 만들기",
    copied: "복사했습니다",
    copy: "복사",
    close: "초안 닫기",
    content: "초안 내용 (고칠 수 있습니다)",
    writing: "초안을 쓰는 중입니다",
  },
  en: {
    adapter: { chrome: "Chrome built-in AI", mock: "Mock" },
    state: {
      streaming: "Writing…",
      done: "Done",
      stopped: "Stopped",
      error: "Couldn't write the draft",
    },
    region: "Report draft",
    title: "Report draft",
    adapterTitle: "AI adapter writing the draft",
    stop: "Stop",
    regenerate: "Regenerate",
    copied: "Copied",
    copy: "Copy",
    close: "Close draft",
    content: "Draft content (editable)",
    writing: "Writing the draft",
  },
});

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
  const msg = useT(messages);
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
      aria-label={msg.region}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles size={15} aria-hidden="true" className="text-accent" />
          {msg.title}
        </h2>
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-full border border-line bg-panel px-2 text-2xs text-fg-secondary",
            adapter === "chrome" &&
              "border-accent-line bg-accent-soft text-accent",
          )}
          title={msg.adapterTitle}
        >
          {msg.adapter[adapter]}
        </span>
        <span
          data-state={state}
          className="text-xs text-fg-muted data-[state=error]:text-danger"
          aria-live="polite"
        >
          {msg.state[state]}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {streaming ? (
            <button
              type="button"
              className={button({ size: "sm", class: "whitespace-nowrap" })}
              onClick={stop}
            >
              <Square size={13} aria-hidden="true" />
              {msg.stop}
            </button>
          ) : (
            <button
              type="button"
              className={button({ size: "sm", class: "whitespace-nowrap" })}
              onClick={() => start(data)}
            >
              <RotateCcw size={13} aria-hidden="true" />
              {msg.regenerate}
            </button>
          )}
          <button
            type="button"
            className={button({ size: "sm", class: "whitespace-nowrap" })}
            disabled={!text || streaming}
            onClick={copy}
          >
            <Copy size={13} aria-hidden="true" />
            {copied ? msg.copied : msg.copy}
          </button>
          <button
            type="button"
            className={toolButton()}
            aria-label={msg.close}
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
        aria-label={msg.content}
        placeholder={streaming ? msg.writing : ""}
        onChange={(e) => setText(e.currentTarget.value)}
      />
    </section>
  );
}

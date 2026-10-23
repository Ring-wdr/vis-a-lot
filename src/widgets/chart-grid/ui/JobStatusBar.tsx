"use client";

import { Ban, Check, CircleAlert, Clock, Cpu, Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { isTerminal, type JobStateResponse } from "@/shared/api/types";
import { cn, tv } from "@/shared/lib/tw";

const bar =
  "flex min-w-0 flex-1 items-center gap-3.5 overflow-hidden whitespace-nowrap text-xs text-fg-secondary tabular-nums";

// 단계 이름 길이가 바뀌어도 오른쪽 칸들이 밀리지 않도록 가장 긴 이름만큼 자리를 둔다.
const status = tv({
  base: "inline-flex min-w-[9.5em] flex-none items-center gap-1 rounded-full bg-accent-soft px-2 py-1 font-semibold text-accent",
  variants: {
    tone: {
      done: "bg-panel text-fg",
      danger: "bg-danger/12 text-danger",
    },
  },
});

// 묶음은 줄어들지 않는다. 줄어들면 내용이 넘쳐 뒤 묶음과 겹친다.
// 폭이 모자라면 하단 바가 끝에서 잘라낸다.
const group = "inline-flex flex-none items-center gap-1.5";
const metaItem = "inline-flex items-center gap-1 data-zero:opacity-40";

const STATUS_LABEL: Record<JobStateResponse["status"], string> = {
  init: "대기",
  progress: "진행 중",
  success: "완료",
  failed: "실패",
  cancelled: "취소됨",
};

function phaseLabel(job: JobStateResponse) {
  if (isTerminal(job.status)) {
    if (job.status === "success" && job.counts.failed > 0) return "일부 실패";
    return STATUS_LABEL[job.status];
  }
  if (job.phase === "dataset") return "데이터 준비 중";
  if (job.phase === "query") return "데이터 조회 중";
  return job.kind === "redraw" ? "다시 그리는 중" : "렌더링 중";
}

function seconds(ms: number) {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}초`;
  return `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`;
}

/** 진행 중에는 경과 시간이 흐르도록 주기적으로 다시 그린다. */
function useNow(active: boolean, interval = 500) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [active, interval]);
  return now;
}

/**
 * 하단 바: job 단계와 진행률, 상태별 item 수, 경과 시간, 처리 속도와 남은 시간, Render Worker 수.
 * 렌더 단계에서는 끝난 item 수 / 렌더 경과 시간으로 속도를, 남은 item 수로 남은 시간을 어림한다.
 */
export function JobStatusBar({ job }: { job: JobStateResponse }) {
  const running = !isTerminal(job.status);
  const now = useNow(running);
  const { counts, timing, progress } = job;
  const end = timing.endedAt ?? now;
  const elapsed = end - timing.createdAt;
  const finished = counts.success + counts.failed + counts.cancelled;
  const renderMs = timing.renderStartedAt ? end - timing.renderStartedAt : 0;
  const rate =
    renderMs > 500 && finished > 0 ? finished / (renderMs / 1000) : 0;
  const remaining = progress.total - progress.done;
  const eta =
    running && job.phase === "render" && rate > 0
      ? (remaining / rate) * 1000
      : 0;
  const ratio = progress.total > 0 ? progress.done / progress.total : 0;

  if (job.error) {
    return (
      <div className={bar}>
        <span className={status({ tone: "danger" })}>
          <CircleAlert size={14} aria-hidden="true" />
          {phaseLabel(job)}
        </span>
        <span
          role="alert"
          className="overflow-hidden text-ellipsis text-danger"
        >
          {job.error}
        </span>
      </div>
    );
  }

  const countSlots = [
    { key: "success", mark: "✓", title: "완료", value: counts.success },
    { key: "running", mark: "◐", title: "그리는 중", value: counts.running },
    { key: "queued", mark: "…", title: "대기", value: counts.queued },
    { key: "failed", mark: "✕", title: "실패", value: counts.failed },
    { key: "cancelled", mark: "⊘", title: "취소", value: counts.cancelled },
  ] as const;

  return (
    <div className={bar}>
      <span
        className={status({
          tone: !running
            ? job.status === "success" && counts.failed === 0
              ? "done"
              : "danger"
            : undefined,
        })}
      >
        {running ? (
          <Loader size={14} className="animate-spin" aria-hidden="true" />
        ) : job.status === "cancelled" ? (
          <Ban size={14} aria-hidden="true" />
        ) : (
          <Check size={14} aria-hidden="true" />
        )}
        {phaseLabel(job)}
      </span>

      <span className="inline-flex flex-none items-center gap-2">
        {/* 조회 단계에서는 item 수를 아직 몰라 막대를 움직이는 모양(indeterminate)으로 둔다. */}
        {job.phase === "query" ? (
          <progress className="w-35" />
        ) : (
          <progress
            className="w-35"
            value={progress.done}
            max={progress.total || 1}
          />
        )}
        {/* 숫자가 늘어나도 칸 폭이 바뀌지 않도록 가장 긴 값만큼 자리를 잡아 둔다.
            '1,000,000 / 1,000,000 행'과 '30,000 / 30,000 item · 100%' 중 긴 쪽 */}
        <span className="min-w-[28ch]">
          {job.phase === "query"
            ? "item 수 세는 중"
            : `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} ${job.phase === "dataset" ? "행" : "item"}${job.phase === "dataset" ? "" : ` · ${Math.floor(ratio * 100)}%`}`}
        </span>
      </span>

      <span className={group}>
        {countSlots.map((c) => (
          <span
            key={c.key}
            title={c.title}
            data-zero={c.value === 0 || undefined}
            // 상태별 수는 item 최대 30,000개(6자) + 기호
            className={cn(
              "min-w-[7ch] data-zero:opacity-40",
              c.key === "failed" && c.value > 0 && "text-danger",
            )}
          >
            {c.mark} {c.value.toLocaleString()}
          </span>
        ))}
      </span>

      <span className={group}>
        <span title="경과 시간" className={cn(metaItem, "min-w-[8ch]")}>
          <Clock size={12} aria-hidden="true" /> {seconds(elapsed)}
        </span>
        <span
          title="처리 속도"
          className={cn(metaItem, "min-w-[11ch]")}
          data-zero={rate === 0 || undefined}
        >
          {rate > 0 ? rate.toFixed(1) : "–"} item/s
        </span>
        <span
          title="남은 시간 (어림)"
          className={cn(metaItem, "min-w-[12ch]")}
          data-zero={eta === 0 || undefined}
        >
          {eta > 0 ? `약 ${seconds(eta)} 남음` : "남은 시간 –"}
        </span>
        <span title="Render Worker 수" className={metaItem}>
          <Cpu size={12} aria-hidden="true" /> {job.renderWorkers}
        </span>
      </span>
    </div>
  );
}

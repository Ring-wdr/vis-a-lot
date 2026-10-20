"use client";

import { Ban, Check, CircleAlert, Clock, Cpu, Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { isTerminal, type JobStateResponse } from "@/shared/api/types";
import styles from "./JobStatusBar.module.css";

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
      <div className={styles.bar}>
        <span className={styles.status} data-tone="danger">
          <CircleAlert size={14} aria-hidden="true" />
          {phaseLabel(job)}
        </span>
        <span role="alert" className={styles.error}>
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
    <div className={styles.bar}>
      <span
        className={styles.status}
        data-tone={
          !running
            ? job.status === "success" && counts.failed === 0
              ? "done"
              : "danger"
            : undefined
        }
      >
        {running ? (
          <Loader size={14} className={styles.spin} aria-hidden="true" />
        ) : job.status === "cancelled" ? (
          <Ban size={14} aria-hidden="true" />
        ) : (
          <Check size={14} aria-hidden="true" />
        )}
        {phaseLabel(job)}
      </span>

      <span className={styles.progress}>
        {/* 조회 단계에서는 item 수를 아직 몰라 막대를 움직이는 모양(indeterminate)으로 둔다. */}
        {job.phase === "query" ? (
          <progress />
        ) : (
          <progress value={progress.done} max={progress.total || 1} />
        )}
        <span className={styles.progressText}>
          {job.phase === "query"
            ? "item 수 세는 중"
            : `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} ${job.phase === "dataset" ? "행" : "item"}${job.phase === "dataset" ? "" : ` · ${Math.floor(ratio * 100)}%`}`}
        </span>
      </span>

      <span className={styles.counts}>
        {countSlots.map((c) => (
          <span
            key={c.key}
            title={c.title}
            data-zero={c.value === 0 || undefined}
            data-tone={c.key === "failed" && c.value > 0 ? "danger" : undefined}
            className={styles.count}
          >
            {c.mark} {c.value.toLocaleString()}
          </span>
        ))}
      </span>

      <span className={styles.meta}>
        <span title="경과 시간" className={styles.elapsed}>
          <Clock size={12} aria-hidden="true" /> {seconds(elapsed)}
        </span>
        <span
          title="처리 속도"
          className={styles.rate}
          data-zero={rate === 0 || undefined}
        >
          {rate > 0 ? rate.toFixed(1) : "–"} item/s
        </span>
        <span
          title="남은 시간 (어림)"
          className={styles.eta}
          data-zero={eta === 0 || undefined}
        >
          {eta > 0 ? `약 ${seconds(eta)} 남음` : "남은 시간 –"}
        </span>
        <span title="Render Worker 수">
          <Cpu size={12} aria-hidden="true" /> {job.renderWorkers}
        </span>
      </span>
    </div>
  );
}

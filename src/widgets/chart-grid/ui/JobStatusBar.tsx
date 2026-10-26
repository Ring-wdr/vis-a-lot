"use client";

import {
  Ban,
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Cpu,
  Hourglass,
  Loader,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { isTerminal, type JobStateResponse } from "@/shared/api/types";
import { cn, tv } from "@/shared/lib/tw";

// 하단 바는 테두리 상자 하나에 구획을 나란히 두고 세로 선으로 가른다. 높이는 ChartGrid의 h-8을 채운다.
// 구획은 줄어들지 않는다. 줄어들면 내용이 넘쳐 뒤 구획과 겹친다. 대신 상자 폭(@container)이 모자라면
// Worker 수 → 시간 → 상태별 수 순서로 구획을 통째로 숨긴다. 상태와 진행률은 늘 보인다.
const section =
  "flex h-full flex-none items-center gap-2 border-line border-r px-3";

// 맨 앞 상태 구획은 상태 색으로 칠한다. 단계 이름 길이가 바뀌어도 뒤 구획이 밀리지 않도록 가장 긴 이름만큼 자리를 둔다.
const status = tv({
  base: "flex h-full min-w-[9.5em] flex-none items-center gap-1.5 border-r border-line bg-accent-soft px-3 font-semibold text-accent",
  variants: {
    tone: {
      done: "bg-panel text-fg",
      danger: "bg-danger/8 text-danger",
    },
  },
});

const metaItem =
  "inline-flex items-center gap-1 data-zero:text-fg-muted data-zero:opacity-60";
const caption = "text-fg-muted";

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
      <>
        <span className={status({ tone: "danger" })}>
          <CircleAlert size={14} aria-hidden="true" />
          {phaseLabel(job)}
        </span>
        <span role="alert" className="min-w-0 flex-1 truncate px-3 text-danger">
          {job.error}
        </span>
      </>
    );
  }

  const countSlots: {
    key: string;
    Icon: LucideIcon;
    title: string;
    value: number;
    tone?: string;
  }[] = [
    { key: "success", Icon: CircleCheck, title: "완료", value: counts.success },
    {
      key: "running",
      Icon: LoaderCircle,
      title: "그리는 중",
      value: counts.running,
      tone: "text-accent",
    },
    { key: "queued", Icon: Hourglass, title: "대기", value: counts.queued },
    {
      key: "failed",
      Icon: CircleX,
      title: "실패",
      value: counts.failed,
      tone: "text-danger",
    },
    {
      key: "cancelled",
      Icon: CircleDashed,
      title: "취소",
      value: counts.cancelled,
    },
  ];
  const unit = job.phase === "dataset" ? "행" : "item";

  return (
    <>
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

      {/* 진행률: 막대 + 끝난 수 / 전체 + 비율 */}
      <span className={section}>
        <span
          role="progressbar"
          aria-label="진행률"
          aria-valuemin={0}
          aria-valuemax={progress.total || 1}
          aria-valuenow={job.phase === "query" ? undefined : progress.done}
          className="relative h-1.5 w-32 overflow-hidden rounded-full bg-panel-strong"
        >
          {job.phase === "query" ? (
            // 조회 단계에서는 item 수를 아직 몰라 흐르는 막대로 둔다.
            <span className="absolute inset-0 animate-shimmer bg-linear-to-r from-accent-soft via-accent to-accent-soft bg-size-[200%_100%] motion-reduce:animate-none" />
          ) : (
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-200",
                !running && counts.failed > 0 && "bg-danger",
              )}
              style={{ width: `${ratio * 100}%` }}
            />
          )}
        </span>
        {job.phase !== "dataset" && job.phase !== "query" && (
          <span className="min-w-[4ch] font-semibold text-fg">
            {Math.floor(ratio * 100)}%
          </span>
        )}
        {/* 숫자가 늘어나도 칸 폭이 바뀌지 않도록 가장 긴 값만큼 자리를 잡아 둔다.
            '1,000,000 / 1,000,000 행'과 '30,000 / 30,000 item' 중 긴 쪽 */}
        <span className="min-w-[22ch]">
          {job.phase === "query" ? (
            <span className={caption}>item 수 세는 중</span>
          ) : (
            <>
              <span className="font-semibold text-fg">
                {progress.done.toLocaleString()}
              </span>
              <span className={caption}>
                {" "}
                / {progress.total.toLocaleString()} {unit}
              </span>
            </>
          )}
        </span>
      </span>

      {/* 상태별 item 수. 0이면 흐리게 둔다. 폭이 좁으면 숨긴다. */}
      <span className={cn(section, "gap-3 @max-3xl:hidden")}>
        {countSlots.map(({ key, Icon, title, value, tone }) => (
          <span
            key={key}
            title={title}
            data-zero={value === 0 || undefined}
            // 상태별 수는 item 최대 30,000개(6자) + 아이콘
            className={cn(metaItem, "min-w-[6ch]", value > 0 && tone)}
          >
            <Icon size={13} aria-label={title} />
            {value.toLocaleString()}
          </span>
        ))}
      </span>

      {/* 시간: 경과 · 처리 속도 · 남은 시간 */}
      <span className={cn(section, "gap-3 @max-5xl:hidden")}>
        <span title="경과 시간" className="min-w-[9ch]">
          <span className={caption}>경과 </span>
          {seconds(elapsed)}
        </span>
        <span
          title="처리 속도"
          className={cn(metaItem, "min-w-[11ch]")}
          data-zero={rate === 0 || undefined}
        >
          <span className={caption}>속도 </span>
          {rate > 0 ? `${rate.toFixed(1)} item/s` : "–"}
        </span>
        <span
          title="남은 시간 (어림)"
          className={cn(metaItem, "min-w-[11ch]")}
          data-zero={eta === 0 || undefined}
        >
          <span className={caption}>남은 </span>
          {eta > 0 ? `약 ${seconds(eta)}` : "–"}
        </span>
      </span>

      <span className={cn(section, "@max-6xl:hidden")} title="Render Worker 수">
        <Cpu size={13} aria-hidden="true" />
        <span>
          <span className={caption}>Worker </span>
          {job.renderWorkers}
        </span>
      </span>
    </>
  );
}

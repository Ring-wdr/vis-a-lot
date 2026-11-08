"use client";

import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
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
import { isTerminal, type JobStateResponse } from "@/shared/api/types";
import { intlLocale, useLocale } from "@/shared/lib/i18n";
import { cn, tv } from "@/shared/lib/tw";
import { useNow } from "@/shared/lib/use-now";
import "../config/messages";

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

function statusLabel(status: JobStateResponse["status"]) {
  switch (status) {
    case "init":
      return t({ message: "대기", context: "job status" });
    case "progress":
      return t({ message: "진행 중", context: "job status" });
    case "success":
      return t({ message: "완료", context: "job status" });
    case "failed":
      return t({ message: "실패", context: "job status" });
    case "cancelled":
      return t({ message: "취소됨", context: "job status" });
  }
}

function phaseLabel(job: JobStateResponse) {
  if (isTerminal(job.status)) {
    if (job.status === "success" && job.counts.failed > 0) return t`일부 실패`;
    return statusLabel(job.status);
  }
  if (job.phase === "dataset") return t`데이터 준비 중`;
  if (job.phase === "query") return t`데이터 조회 중`;
  return job.kind === "redraw" ? t`다시 그리는 중` : t`렌더링 중`;
}

function seconds(ms: number) {
  const total = ms / 1000;
  if (total < 60) {
    const s = total.toFixed(1);
    return t({ message: `${s}초`, comment: "s: 초 (소수 한 자리)" });
  }
  const m = Math.floor(total / 60);
  const s = Math.round(total % 60);
  return t({ message: `${m}분 ${s}초`, comment: "m: 분, s: 초" });
}

/**
 * 하단 바: job 단계와 진행률, 상태별 item 수, 경과 시간, 처리 속도와 남은 시간, Render Worker 수.
 * 렌더 단계에서는 끝난 item 수 / 렌더 경과 시간으로 속도를, 남은 item 수로 남은 시간을 어림한다.
 */
export function JobStatusBar({ job }: { job: JobStateResponse }) {
  // phaseLabel·seconds는 전역 t로 읽으므로 여기서 언어 변경을 구독한다.
  const locale = useLocale();
  const { t } = useLingui();
  const intl = intlLocale(locale);
  const running = !isTerminal(job.status);
  // 진행 중에는 경과 시간이 흐르도록 주기적으로 다시 그린다.
  const now = useNow(500, running);
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
  const etaText = eta > 0 ? seconds(eta) : "";

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
    {
      key: "success",
      Icon: CircleCheck,
      title: t({ message: "완료", context: "item count" }),
      value: counts.success,
    },
    {
      key: "running",
      Icon: LoaderCircle,
      title: t({ message: "그리는 중", context: "item count" }),
      value: counts.running,
      tone: "text-accent",
    },
    {
      key: "queued",
      Icon: Hourglass,
      title: t({ message: "대기", context: "item count" }),
      value: counts.queued,
    },
    {
      key: "failed",
      Icon: CircleX,
      title: t({ message: "실패", context: "item count" }),
      value: counts.failed,
      tone: "text-danger",
    },
    {
      key: "cancelled",
      Icon: CircleDashed,
      title: t({ message: "취소", context: "item count" }),
      value: counts.cancelled,
    },
  ];
  const unit =
    job.phase === "dataset"
      ? t({ message: "행", context: "count unit" })
      : "item";

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
          aria-label={t`진행률`}
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
            '1,000,000 / 1,000,000 rows'(영어가 가장 길다). 언어를 바꿔도 폭이 같다 */}
        <span className="min-w-[28ch]">
          {job.phase === "query" ? (
            <span className={caption}>
              <Trans>item 수 세는 중</Trans>
            </span>
          ) : (
            <>
              <span className="font-semibold text-fg">
                {progress.done.toLocaleString(intl)}
              </span>
              <span className={caption}>
                {" "}
                / {progress.total.toLocaleString(intl)} {unit}
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
            {value.toLocaleString(intl)}
          </span>
        ))}
      </span>

      {/* 시간: 경과 · 처리 속도 · 남은 시간 */}
      <span className={cn(section, "gap-3 @max-5xl:hidden")}>
        <span title={t`경과 시간`} className="min-w-[9ch]">
          <span className={caption}>
            {t({ message: "경과", context: "elapsed time caption" })}{" "}
          </span>
          {seconds(elapsed)}
        </span>
        <span
          title={t`처리 속도`}
          className={cn(metaItem, "min-w-[11ch]")}
          data-zero={rate === 0 || undefined}
        >
          <span className={caption}>
            {t({ message: "속도", context: "throughput caption" })}{" "}
          </span>
          {rate > 0 ? `${rate.toFixed(1)} item/s` : "–"}
        </span>
        <span
          title={t`남은 시간 (어림)`}
          className={cn(metaItem, "min-w-[11ch]")}
          data-zero={eta === 0 || undefined}
        >
          <span className={caption}>
            {t({ message: "남은", context: "time left caption" })}{" "}
          </span>
          {eta > 0
            ? t({
                message: `약 ${etaText}`,
                comment: "etaText: 2.5초, 1분 3초 같은 시간",
              })
            : "–"}
        </span>
      </span>

      <span
        className={cn(section, "@max-6xl:hidden")}
        title={t`Render Worker 수`}
      >
        <Cpu size={13} aria-hidden="true" />
        <span>
          <span className={caption}>Worker </span>
          {job.renderWorkers}
        </span>
      </span>
    </>
  );
}

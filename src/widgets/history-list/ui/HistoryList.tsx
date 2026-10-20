/* biome-ignore-all lint/performance/noImgElement: 썸네일은 history에 저장된 data URL이다. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { restoreOf } from "@/entities/chart/lib/share";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useOpenChart } from "@/features/open-chart/model/open-chart";
import { api } from "@/shared/api/api";
import type { HistoryEventType, HistorySummary } from "@/shared/api/types";
import { AGG_LABELS } from "@/shared/config/dataset";
import { columnLabel } from "@/shared/lib/format";
import styles from "@/shared/ui/workspace.module.css";

const CHART_LABELS = {
  scatter: "Scatter",
  bar: "Bar",
  boxplot: "Boxplot",
} as const;

const EVENT_LABELS: Record<HistoryEventType, string> = {
  zoom: "확대",
  shape: "도형",
  undo: "되돌리기",
  clearShapes: "도형 삭제",
  color: "개별 색",
  common: "공통 속성",
  grid: "grid",
};

const STATUS_LABELS = { cancelled: "취소", failed: "실패" } as const;

const relative = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

function timeAgo(ms: number) {
  const diff = (ms - Date.now()) / 1000;
  if (Math.abs(diff) < 60) return relative.format(Math.round(diff), "second");
  if (Math.abs(diff) < 3600)
    return relative.format(Math.round(diff / 60), "minute");
  if (Math.abs(diff) < 86_400)
    return relative.format(Math.round(diff / 3600), "hour");
  return relative.format(Math.round(diff / 86_400), "day");
}

function titleOf({ spec }: HistorySummary) {
  const measure =
    spec.chartType === "bar"
      ? `${AGG_LABELS[spec.agg]}(${columnLabel(spec.y)})`
      : columnLabel(spec.y);
  return `${CHART_LABELS[spec.chartType]} · ${columnLabel(spec.x)} × ${measure}`;
}

function detailOf(entry: HistorySummary) {
  const parts = [
    `${(entry.rows / 10_000).toLocaleString()}만 행`,
    entry.spec.splitBy.length > 0
      ? `split ${entry.spec.splitBy.map(columnLabel).join(entry.spec.splitSeparator)}`
      : "split 없음",
    `${entry.itemCount.toLocaleString()} item`,
  ];
  for (const status of ["cancelled", "failed"] as const) {
    const n = entry.statusCounts[status];
    if (n) parts.push(`${STATUS_LABELS[status]} ${n}`);
  }
  return parts.join(" · ");
}

function eventsOf(entry: HistorySummary) {
  return Object.entries(entry.eventCounts)
    .map(([type, n]) => `${EVENT_LABELS[type as HistoryEventType]} ${n}`)
    .join(" · ");
}

/**
 * history 화면의 왼쪽 목록. 고르면 저장된 설정과 item 상태로 다시 그려 보여준다.
 * 다시 보기는 history에 기록하지 않으므로 목록 순서와 썸네일이 바뀌지 않는다.
 */
export function HistoryList() {
  const list = useQuery({ queryKey: ["history"], queryFn: api.history });
  const open = useOpenChart();
  const viewing = useWorkspace((s) => s.current?.historyId);

  if (list.error) {
    return (
      <p role="alert" className={styles.error}>
        {list.error.message}
      </p>
    );
  }
  if (list.data?.entries.length === 0) {
    return <p className={styles.muted}>아직 그린 차트가 없습니다.</p>;
  }

  return (
    <ul className={styles.historyList}>
      {list.data?.entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            className={styles.historyEntry}
            aria-current={viewing === entry.id || undefined}
            disabled={open.isPending}
            onClick={async () => {
              const detail = await api.historyDetail(entry.id);
              open.mutate({
                spec: detail.spec,
                restore: restoreOf(detail),
                historyId: detail.id,
              });
            }}
          >
            {entry.thumbnail ? (
              <img src={entry.thumbnail} alt="" width={72} height={45} />
            ) : (
              <span className={styles.historyThumbEmpty} />
            )}
            <span className={styles.historyText}>
              <span className={styles.historyTitle}>{titleOf(entry)}</span>
              <span className={styles.muted}>{detailOf(entry)}</span>
              {eventsOf(entry) && (
                <span className={styles.muted}>+ {eventsOf(entry)}</span>
              )}
              <span className={styles.muted}>{timeAgo(entry.updatedAt)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

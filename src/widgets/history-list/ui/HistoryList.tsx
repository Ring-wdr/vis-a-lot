/* biome-ignore-all lint/performance/noImgElement: 썸네일은 history에 저장된 data URL이다. */
"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { restoreOf } from "@/entities/chart/lib/share";
import { chartTitle } from "@/entities/chart/lib/title";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import type { WorkspaceTab } from "@/entities/workspace/model/tabs-store";
import {
  useWorkspace,
  useWorkspaceStore,
} from "@/entities/workspace/model/workspace-scope";
import { openChartIn } from "@/features/open-chart/model/open-chart";
import { api } from "@/shared/api/api";
import { useColumnsByDataset, useDatasetNames } from "@/shared/api/queries";
import type { HistoryEventType, HistorySummary } from "@/shared/api/types";
import type { ColumnLookup } from "@/shared/lib/format";
import { showAlert } from "@/shared/ui/AlertDialog";
import { EmptyState, Skeleton, Spinner } from "@/shared/ui/Loading";
import styles from "@/shared/ui/workspace.module.css";

const EVENT_LABELS: Record<HistoryEventType, string> = {
  zoom: "확대",
  shape: "도형",
  undo: "되돌리기",
  clearShapes: "도형 삭제",
  color: "개별 색",
  legend: "legend 위치",
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

function detailOf(
  entry: HistorySummary,
  columns: ColumnLookup,
  datasetName: string,
) {
  const parts = [
    datasetName,
    entry.spec.splitBy.length > 0
      ? `split ${entry.spec.splitBy.map(columns.label).join(entry.spec.splitSeparator)}`
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
 * history 화면의 왼쪽 목록. 고르면 그 건을 history 탭으로 열어 저장된 설정과 item 상태로 다시 그린다.
 * 다시 보기는 history에 기록하지 않으므로 목록 순서와 썸네일이 바뀌지 않는다.
 */
export function HistoryList() {
  const list = useQuery({ queryKey: ["history"], queryFn: api.history });
  const openHistory = useTabs((s) => s.openHistory);
  const close = useTabs((s) => s.close);
  const scoped = useWorkspaceStore();
  const load = useMutation({
    mutationFn: async ({ id, tab }: { id: string; tab: WorkspaceTab }) => {
      const detail = await api.historyDetail(id);
      await openChartIn(
        tab.store,
        { spec: detail.spec, restore: restoreOf(detail), historyId: detail.id },
        scoped.getState().gridArea,
      );
    },
    // 열지 못한 건을 빈 탭으로 남기면 다시 눌러도 이미 열린 탭으로 보고 불러오지 않는다.
    onError: (err, { tab }) => {
      close(tab.id);
      showAlert(err.message);
    },
  });
  const viewing = useWorkspace((s) => s.current?.historyId);
  // 컬럼 라벨은 데이터셋 스키마에 있으므로, 목록에 나오는 데이터셋의 스키마를 함께 받는다.
  const columnsOf = useColumnsByDataset(
    list.data?.entries.map((e) => e.dataset) ?? [],
  );
  const nameOf = useDatasetNames();

  if (list.error) {
    return (
      <p role="alert" className={styles.error}>
        {list.error.message}
      </p>
    );
  }
  if (list.isPending) {
    // 목록 항목과 같은 모양으로 자리를 잡아 둔다.
    return (
      <ul className={styles.historyList} aria-busy="true">
        {([90, 70, 90] as const).map((width, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 받기 전 자리 표시용
          <li key={i} className={styles.historyEntry} data-skeleton="">
            <span className={styles.historyThumbEmpty} />
            <span className={styles.historyText}>
              <Skeleton width={width} />
              <Skeleton width={70} />
              <Skeleton width={30} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (list.data.entries.length === 0) {
    return (
      <EmptyState size="sm" icon={<History size={16} />} title="기록 없음">
        gallery에서 draw하면 여기에 쌓입니다.
      </EmptyState>
    );
  }

  return (
    <ul className={styles.historyList}>
      {list.data.entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            className={styles.historyEntry}
            aria-current={viewing === entry.id || undefined}
            disabled={load.isPending}
            onClick={() => {
              // 이미 열린 건이면 그 탭으로 가고, 처음 여는 건이면 새 탭에 다시 그린다.
              const opened = openHistory(entry.id);
              if (opened?.created)
                load.mutate({ id: entry.id, tab: opened.tab });
            }}
          >
            <span className={styles.historyThumb}>
              {entry.thumbnail ? (
                <img src={entry.thumbnail} alt="" width={72} height={45} />
              ) : (
                <span className={styles.historyThumbEmpty} />
              )}
              {/* 고른 건을 불러와 탭에 그리는 동안 */}
              {load.isPending && load.variables?.id === entry.id && (
                <span className={styles.historyThumbBusy} aria-busy="true">
                  <Spinner size="sm" />
                </span>
              )}
            </span>
            <span className={styles.historyText}>
              <span className={styles.historyTitle}>
                {chartTitle(entry.spec, columnsOf(entry.dataset))}
              </span>
              <span className={styles.muted}>
                {detailOf(
                  entry,
                  columnsOf(entry.dataset),
                  nameOf(entry.dataset),
                )}
              </span>
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

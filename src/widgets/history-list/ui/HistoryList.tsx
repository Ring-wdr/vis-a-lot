/* biome-ignore-all lint/performance/noImgElement: 썸네일은 history에 저장된 data URL이다. */
"use client";

import { i18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { History, X } from "lucide-react";
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
import {
  useColumnsByDataset,
  useDatasetNames,
  useHistoryList,
} from "@/shared/api/queries";
import type { HistoryEventType, HistorySummary } from "@/shared/api/types";
import type { ColumnLookup } from "@/shared/lib/format";
import { intlLocale, localeCached } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { EmptyState, Skeleton, Spinner } from "@/shared/ui/Loading";
import "../config/messages";

const historyList = "flex flex-col gap-1.5";
const historyEntry =
  "flex w-full cursor-pointer gap-2.5 rounded-md border border-line bg-elevated p-1.5 text-left enabled:hover:border-accent aria-current:border-accent aria-current:bg-accent-soft";
const historyThumb = "h-11 w-18 flex-none rounded-sm bg-panel object-cover";
// 오른쪽 위 지우기 버튼 자리만큼 글자를 비운다.
const historyText = "flex min-w-0 flex-col gap-0.5 pr-4";
const muted = "text-2xs text-fg-muted";
// 카드 오른쪽 위에 겹치는 지우기 버튼. 커서를 올리거나 포커스가 들어오면 보이고, 커서 없는 기기에서는 늘 보인다.
const deleteButton =
  "absolute top-1 right-1 grid size-4.5 cursor-pointer place-items-center rounded-full border border-line bg-elevated text-fg-secondary opacity-0 shadow-sm transition-opacity duration-120 group-hover/entry:opacity-100 focus-visible:opacity-100 hover:border-danger hover:text-danger disabled:cursor-default hover-none:opacity-100";

// history 한 건에 남은 편집 횟수의 이름 ("확대 3 · 도형 1")
const EVENTS: Record<HistoryEventType, MessageDescriptor> = {
  zoom: msg({ message: "확대", context: "history event count" }),
  shape: msg({ message: "도형", context: "history event count" }),
  undo: msg({ message: "되돌리기", context: "history event count" }),
  clearShapes: msg({ message: "도형 삭제", context: "history event count" }),
  selection: msg({ message: "선택", context: "history event count" }),
  favorite: msg({ message: "즐겨찾기", context: "history event count" }),
  delete: msg({ message: "점 삭제", context: "history event count" }),
  color: msg({ message: "개별 색", context: "history event count" }),
  legend: msg({ message: "legend", context: "history event count" }),
  common: msg({ message: "공통 속성", context: "history event count" }),
  grid: msg({ message: "grid", context: "history event count" }),
  options: msg({ message: "개별 속성", context: "history event count" }),
};

const NO_SPLIT = msg`split 없음`;

// 끝내지 못한 item 수의 이름 ("취소 2")
const STATUS = {
  cancelled: msg({ message: "취소", context: "history item status count" }),
  failed: msg({ message: "실패", context: "history item status count" }),
};

const relative = localeCached(
  (locale) => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
);

function timeAgo(ms: number) {
  const diff = (ms - Date.now()) / 1000;
  const r = relative();
  if (Math.abs(diff) < 60) return r.format(Math.round(diff), "second");
  if (Math.abs(diff) < 3600) return r.format(Math.round(diff / 60), "minute");
  if (Math.abs(diff) < 86_400) return r.format(Math.round(diff / 3600), "hour");
  return r.format(Math.round(diff / 86_400), "day");
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
      : i18n._(NO_SPLIT),
    `${entry.itemCount.toLocaleString(intlLocale())} item`,
  ];
  for (const status of ["cancelled", "failed"] as const) {
    const n = entry.statusCounts[status];
    if (n) parts.push(`${i18n._(STATUS[status])} ${n}`);
  }
  return parts.join(" · ");
}

function eventsOf(entry: HistorySummary) {
  return Object.entries(entry.eventCounts)
    .map(([type, n]) => `${i18n._(EVENTS[type as HistoryEventType])} ${n}`)
    .join(" · ");
}

/**
 * history 화면의 왼쪽 목록. 고르면 그 건을 history 탭으로 열어 저장된 설정과 item 상태로 다시 그린다.
 * 다시 보기는 history에 기록하지 않으므로 목록 순서와 썸네일이 바뀌지 않는다.
 */
export function HistoryList() {
  const { t } = useLingui();
  const list = useHistoryList();
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
  const client = useQueryClient();
  const closeHistory = useTabs((s) => s.closeHistory);
  const remove = useMutation({
    mutationFn: api.deleteHistory,
    onSuccess: (_, id) => {
      // 지운 건을 보던 탭도 닫는다. 다시 그릴 설정이 없다.
      closeHistory(id);
      void client.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (err) => showAlert(err.message),
  });
  const confirmDelete = async (entry: HistorySummary, title: string) => {
    const ok = await showConfirm(
      t`''${title}'' 기록을 지울까요? 지우면 이 기록으로 다시 볼 수 없고, 열려 있는 탭도 닫힙니다.`,
      {
        title: t`history 삭제`,
        confirmLabel: t({ message: "삭제", context: "confirm button" }),
        danger: true,
        children: entry.thumbnail && (
          <img
            src={entry.thumbnail}
            alt=""
            width={240}
            height={150}
            className="mt-3 w-full rounded-sm border border-line bg-panel object-contain"
          />
        ),
      },
    );
    if (ok) remove.mutate(entry.id);
  };

  if (list.error) {
    return (
      <p role="alert" className="text-xs text-danger">
        {list.error.message}
      </p>
    );
  }
  if (list.isPending) {
    // 목록 항목과 같은 모양으로 자리를 잡아 둔다.
    return (
      <ul className={historyList} aria-busy="true">
        {([90, 70, 90] as const).map((width, i) => (
          // 목록을 받는 동안의 자리. 버튼이 아니라 누를 수 없다.
          // biome-ignore lint/suspicious/noArrayIndexKey: 받기 전 자리 표시용
          <li key={i} className={cn(historyEntry, "cursor-default")}>
            <span className={historyThumb} />
            <span className={cn(historyText, "flex-1 justify-center gap-1.5")}>
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
      <EmptyState size="sm" icon={<History size={16} />} title={t`기록 없음`}>
        <Trans>gallery에서 draw하면 여기에 쌓입니다.</Trans>
      </EmptyState>
    );
  }

  return (
    <ul className={historyList}>
      {list.data.entries.map((entry) => {
        const title = chartTitle(entry.spec, columnsOf(entry.dataset));
        const removing = remove.isPending && remove.variables === entry.id;
        return (
          <li key={entry.id} className="group/entry relative">
            <button
              type="button"
              className={historyEntry}
              aria-current={viewing === entry.id || undefined}
              disabled={load.isPending || removing}
              onClick={() => {
                // 이미 열린 건이면 그 탭으로 가고, 처음 여는 건이면 새 탭에 다시 그린다.
                const opened = openHistory(entry.id);
                if (opened?.created)
                  load.mutate({ id: entry.id, tab: opened.tab });
              }}
            >
              <span className="relative flex flex-none">
                {entry.thumbnail ? (
                  <img
                    src={entry.thumbnail}
                    alt=""
                    width={72}
                    height={45}
                    className={historyThumb}
                  />
                ) : (
                  <span className={historyThumb} />
                )}
                {/* 고른 건을 불러와 탭에 그리는 동안 */}
                {load.isPending && load.variables?.id === entry.id && (
                  <span
                    className="absolute inset-0 grid place-items-center rounded-sm bg-overlay"
                    aria-busy="true"
                  >
                    <Spinner size="sm" />
                  </span>
                )}
              </span>
              <span className={historyText}>
                <span className="text-xs font-semibold">{title}</span>
                <span className={muted}>
                  {detailOf(
                    entry,
                    columnsOf(entry.dataset),
                    nameOf(entry.dataset),
                  )}
                </span>
                {eventsOf(entry) && (
                  <span className={muted}>+ {eventsOf(entry)}</span>
                )}
                <span className={muted}>{timeAgo(entry.updatedAt)}</span>
              </span>
            </button>
            {/* 항목 버튼 안에 버튼을 둘 수 없어 형제로 두고 카드 오른쪽 위에 겹친다. */}
            <button
              type="button"
              className={deleteButton}
              aria-label={t({
                message: `${title} 기록 삭제`,
                comment: "title: 차트 이름",
              })}
              title={t`기록 삭제`}
              disabled={removing}
              onClick={() => confirmDelete(entry, title)}
            >
              {removing ? (
                <Spinner size="sm" />
              ) : (
                <X size={11} aria-hidden="true" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

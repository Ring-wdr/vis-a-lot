"use client";

import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Table as TableIcon,
} from "lucide-react";
import { overlay } from "overlay-kit";
import { useId, useRef, useState } from "react";
import { api } from "@/shared/api/api";
import type {
  ItemRowsRequest,
  ItemRowsResponse,
  SampleRowsResponse,
} from "@/shared/api/types";
import { formatValue } from "@/shared/lib/format";
import { cn } from "@/shared/lib/tw";
import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { EmptyState, Skeleton } from "@/shared/ui/Loading";

// 열 폭을 고정해 스크롤하며 행이 바뀌어도 칸이 흔들리지 않게 한다.
const cell =
  "h-7.5 w-35 overflow-hidden text-ellipsis whitespace-nowrap border-line border-b px-2.5 text-left";
const numeric = "text-right tabular-nums";
const rowNumber = "w-16 text-fg-muted tabular-nums";
const head = "sticky top-0 z-1 bg-panel";
const rowHover = "group-hover/row:bg-surface";

/** 서버에서 한 번에 받는 행 수 */
const PAGE_SIZE = 200;
const ROW_HEIGHT = 30;

type Sort = { column: string; desc: boolean } | undefined;

/** 머리를 누를 때마다 오름차순 → 내림차순 → 정렬 없음 */
function nextSort(sort: Sort, column: string): Sort {
  if (sort?.column !== column) return { column, desc: false };
  return sort.desc ? undefined : { column, desc: true };
}

/** 표 한 페이지. item 데이터와 전체 데이터(샘플)가 같은 모양을 쓴다. */
type TablePage = Pick<
  ItemRowsResponse,
  "columns" | "rows" | "total" | "filterCount"
>;

/** 표가 읽는 곳: 제목, 페이지 조회, 행 수 요약, 빈 표 안내 */
type TableSource<P extends TablePage> = {
  /** 쿼리 키. 같은 내용이면 받아 둔 페이지를 다시 쓴다. */
  key: readonly unknown[];
  title: string;
  fetch: (request: ItemRowsRequest, signal: AbortSignal) => Promise<P>;
  summary: (page: P) => string;
  empty: (page: P) => string;
};

/** draw 시점 필터 안내. 화면에 지금 보이는 필터가 아니라 차트를 그릴 때의 필터다. */
const filterNote = (page: TablePage) =>
  page.filterCount > 0 ? ` · draw 시점 필터 ${page.filterCount}개 적용` : "";

/**
 * 데이터를 표로 본다. 보이는 행이 든 페이지만 받아 오는 가상 스크롤이고, 열 머리를 눌러 서버에서 정렬한다.
 */
function DataTable<P extends TablePage>({
  source,
  onClose,
}: {
  source: TableSource<P>;
  onClose: () => void;
}) {
  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<Sort>();
  const [visiblePages, setVisiblePages] = useState<number[]>([0]);

  const pages = useQueries({
    queries: visiblePages.map((page) => ({
      queryKey: [...source.key, sort, page],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        source.fetch(
          { offset: page * PAGE_SIZE, limit: PAGE_SIZE, sort },
          signal,
        ),
      placeholderData: keepPreviousData,
      staleTime: Number.POSITIVE_INFINITY,
    })),
  });
  const first = pages.find((p) => p.data)?.data as P | undefined;
  const failed = pages.find((p) => p.isError)?.error;
  const total = first?.total ?? 0;
  const columns = first?.columns ?? [];

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    onChange: (v) => {
      // 보이는 행이 든 페이지만 받는다. 같은 목록이면 state를 바꾸지 않는다.
      const items = v.getVirtualItems();
      if (items.length === 0) return;
      const from = Math.floor(items[0].index / PAGE_SIZE);
      const to = Math.floor(items[items.length - 1].index / PAGE_SIZE);
      const next = Array.from({ length: to - from + 1 }, (_, i) => from + i);
      setVisiblePages((prev) => (prev.join() === next.join() ? prev : next));
    },
  });

  const rowAt = (index: number) => {
    const page = Math.floor(index / PAGE_SIZE);
    const slot = visiblePages.indexOf(page);
    const data = slot === -1 ? undefined : pages[slot]?.data;
    // 정렬을 바꾼 직후에는 이전 정렬의 페이지가 placeholder로 남아 있으니 쓰지 않는다.
    if (!data || pages[slot]?.isPlaceholderData) return undefined;
    return data.rows[index - page * PAGE_SIZE];
  };

  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom =
    virtualizer.getTotalSize() - (items[items.length - 1]?.end ?? 0);

  const changeSort = (column: string) => {
    setSort(nextSort(sort, column));
    scrollRef.current?.scrollTo({ top: 0 });
    setVisiblePages([0]);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-2.5">
        <h2 id={titleId} className="font-bold text-base">
          {source.title}
        </h2>
        <span className="text-fg-muted text-ui">
          {first ? source.summary(first) + filterNote(first) : "불러오는 중"}
        </span>
      </header>

      {failed ? (
        <p role="alert" className="text-danger text-ui">
          {failed.message}
        </p>
      ) : first && total === 0 ? (
        <EmptyState icon={<TableIcon size={20} />} title="행이 없습니다">
          {source.empty(first)}
        </EmptyState>
      ) : (
        // 가상 스크롤 표: 보이는 행 위아래를 빈 행으로 채워 스크롤 높이를 맞춘다.
        <div
          ref={scrollRef}
          className="h-[min(30rem,60dvh)] overflow-auto rounded-md border border-line"
        >
          <table
            className="w-max min-w-full table-fixed border-collapse text-ui"
            aria-labelledby={titleId}
          >
            <thead>
              <tr>
                <th className={cn(cell, head, rowNumber)}>#</th>
                {columns.map((c) => {
                  const active = sort?.column === c.name;
                  const SortIcon = !active
                    ? ArrowUpDown
                    : sort.desc
                      ? ArrowDown
                      : ArrowUp;
                  return (
                    <th
                      key={c.name}
                      aria-sort={
                        active
                          ? sort.desc
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                      className={cn(
                        cell,
                        head,
                        c.type !== "categorical" && numeric,
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          "inline-flex max-w-full cursor-pointer items-center gap-1 font-semibold text-fg-secondary leading-[inherit]",
                          c.type !== "categorical" && "flex-row-reverse",
                        )}
                        title={`${c.label} (${c.name}) 정렬`}
                        onClick={() => changeSort(c.name)}
                      >
                        <span className="overflow-hidden text-ellipsis">
                          {c.label}
                        </span>
                        <SortIcon
                          size={12}
                          aria-hidden="true"
                          className={cn(
                            "flex-none",
                            active ? "text-accent" : "opacity-40",
                          )}
                        />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {padTop > 0 && (
                // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: 가상 스크롤 높이만 채우는 빈 행이라 표의 행으로 읽히지 않게 한다
                <tr role="presentation">
                  <td className={cell} style={{ height: padTop }} />
                </tr>
              )}
              {first &&
                items.map((v) => {
                  const row = rowAt(v.index);
                  return (
                    <tr key={v.index} className="group/row">
                      <td className={cn(cell, rowNumber, rowHover)}>
                        {(v.index + 1).toLocaleString()}
                      </td>
                      {columns.map((c, i) => (
                        <td
                          key={c.name}
                          className={cn(
                            cell,
                            c.type !== "categorical" && numeric,
                            rowHover,
                          )}
                        >
                          {row ? formatValue(row[i], c.type) : <Skeleton />}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              {padBottom > 0 && (
                // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: 가상 스크롤 높이만 채우는 빈 행이라 표의 행으로 읽히지 않게 한다
                <tr role="presentation">
                  <td className={cell} style={{ height: padBottom }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className={dialogActions}>
        <button
          type="button"
          className={button({ variant: "primary" })}
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function openTable<P extends TablePage>(source: TableSource<P>) {
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      onExited={unmount}
      className="w-[min(60rem,calc(100vw-2rem))] max-w-none"
    >
      <DataTable source={source} onClose={close} />
    </Dialog>
  ));
}

type ItemTarget = { chartId: string; itemKey: string; label: string };

/**
 * 고른 item의 원본 행을 모든 컬럼으로 본다. 선택 필드 차트는 선택 영역이 있으면 그 안의 행만, 지운 점은 뺀다.
 * version은 열 때의 PNG URL이다. 같은 내용이면 받아 둔 페이지를 다시 쓴다.
 */
export function openDataTable(target: ItemTarget, version: string) {
  openTable<ItemRowsResponse>({
    key: ["item-rows", target.chartId, target.itemKey, version],
    title: `${target.label} 데이터`,
    fetch: (request, signal) =>
      api.itemRows(target.chartId, target.itemKey, request, signal),
    summary: (page) =>
      `${page.selected ? "선택한 " : ""}${page.total.toLocaleString()}행`,
    empty: (page) =>
      page.selected
        ? "선택 영역 안에 든 데이터가 없습니다."
        : "이 차트에 그린 데이터가 없습니다.",
  });
}

/**
 * 데이터셋 전체를 그 차트의 draw 시점 필터로 거른 행을 본다. 너무 많으면 서버가 최대 30,000행만 샘플로 준다.
 * jobId가 바뀌면(다시 draw) 필터가 바뀌었을 수 있어 새로 받는다.
 */
export function openSampleTable(chart: {
  chartId: string;
  jobId: string;
  title: string;
}) {
  openTable<SampleRowsResponse>({
    key: ["sample-rows", chart.chartId, chart.jobId],
    title: `전체 데이터 · ${chart.title}`,
    fetch: (request, signal) => api.sampleRows(chart.chartId, request, signal),
    summary: (page) =>
      page.sampled
        ? `전체 ${page.population.toLocaleString()}행 중 ${page.total.toLocaleString()}행 샘플`
        : `${page.total.toLocaleString()}행`,
    empty: () => "필터에 맞는 데이터가 없습니다.",
  });
}

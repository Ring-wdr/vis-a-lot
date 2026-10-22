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
import type { ItemRowsResponse } from "@/shared/api/types";
import { formatValue } from "@/shared/lib/format";
import { Dialog } from "@/shared/ui/Dialog";
import dialogStyles from "@/shared/ui/Dialog.module.css";
import { EmptyState, Skeleton } from "@/shared/ui/Loading";
import styles from "./DataTableDialog.module.css";

/** 서버에서 한 번에 받는 행 수 */
const PAGE_SIZE = 200;
const ROW_HEIGHT = 30;

type Sort = { column: string; desc: boolean } | undefined;

/** 머리를 누를 때마다 오름차순 → 내림차순 → 정렬 없음 */
function nextSort(sort: Sort, column: string): Sort {
  if (sort?.column !== column) return { column, desc: false };
  return sort.desc ? undefined : { column, desc: true };
}

type Target = { chartId: string; itemKey: string; label: string };

/**
 * 고른 item이 그린 데이터를 표로 본다. 선택 영역이 있으면 그 안의 행만, 지운 점은 뺀다.
 * 보이는 행이 든 페이지만 받아 오는 가상 스크롤이고, 열 머리를 눌러 서버에서 정렬한다.
 */
function DataTable({
  target,
  version,
  onClose,
}: {
  target: Target;
  /** 열 때의 PNG URL. 같은 내용이면 받아 둔 페이지를 다시 쓴다. */
  version: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<Sort>();
  const [visiblePages, setVisiblePages] = useState<number[]>([0]);

  const pages = useQueries({
    queries: visiblePages.map((page) => ({
      queryKey: [
        "item-rows",
        target.chartId,
        target.itemKey,
        version,
        sort,
        page,
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.itemRows(
          target.chartId,
          target.itemKey,
          { offset: page * PAGE_SIZE, limit: PAGE_SIZE, sort },
          signal,
        ),
      placeholderData: keepPreviousData,
      staleTime: Number.POSITIVE_INFINITY,
    })),
  });
  const first = pages.find((p) => p.data)?.data as ItemRowsResponse | undefined;
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
    <div className={styles.body}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {target.label} 데이터
        </h2>
        <span className={styles.muted}>
          {first
            ? `${first.selected ? "선택한 " : ""}${total.toLocaleString()}행`
            : "불러오는 중"}
        </span>
      </header>

      {failed ? (
        <p role="alert" className={styles.error}>
          {failed.message}
        </p>
      ) : first && total === 0 ? (
        <EmptyState icon={<TableIcon size={20} />} title="행이 없습니다">
          {first.selected
            ? "선택 영역 안에 든 데이터가 없습니다."
            : "이 차트에 그린 데이터가 없습니다."}
        </EmptyState>
      ) : (
        <div ref={scrollRef} className={styles.scroll}>
          <table className={styles.table} aria-labelledby={titleId}>
            <thead>
              <tr>
                <th className={styles.rowNumber}>#</th>
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
                      data-numeric={c.type !== "categorical" || undefined}
                    >
                      <button
                        type="button"
                        className={styles.sortButton}
                        title={`${c.label} (${c.name}) 정렬`}
                        onClick={() => changeSort(c.name)}
                      >
                        <span>{c.label}</span>
                        <SortIcon
                          size={12}
                          aria-hidden="true"
                          data-active={active || undefined}
                        />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {padTop > 0 && (
                <tr role="presentation">
                  <td style={{ height: padTop }} />
                </tr>
              )}
              {first &&
                items.map((v) => {
                  const row = rowAt(v.index);
                  return (
                    <tr key={v.index}>
                      <td className={styles.rowNumber}>
                        {(v.index + 1).toLocaleString()}
                      </td>
                      {columns.map((c, i) => (
                        <td
                          key={c.name}
                          data-numeric={c.type !== "categorical" || undefined}
                        >
                          {row ? (
                            formatValue(row[i], c.type)
                          ) : (
                            <Skeleton className={styles.cellSkeleton} />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              {padBottom > 0 && (
                <tr role="presentation">
                  <td style={{ height: padBottom }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className={dialogStyles.actions}>
        <button
          type="button"
          className={dialogStyles.primary}
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export function openDataTable(target: Target, version: string) {
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      onExited={unmount}
      className={styles.dialog}
    >
      <DataTable target={target} version={version} onClose={close} />
    </Dialog>
  ));
}

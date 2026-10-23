"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ColumnSummary, ExcludeFilter } from "@/shared/api/types";
import { useDragSelect } from "@/shared/lib/use-drag-select";

type ValuesSummary = Extract<ColumnSummary, { kind: "values" }>;

const ROW_HEIGHT = 26;

const bulkButton =
  "cursor-pointer rounded-sm border border-line bg-elevated px-2 py-0.5 text-11 text-fg disabled:cursor-default disabled:opacity-50";

/**
 * 범주 컬럼 필터: 검색(부분 일치) + 가상 스크롤 목록. 처음엔 전부 포함이고, 체크를 풀면 그 값을 뺀다.
 * lot_id처럼 값이 수천 개여도 보이는 줄만 그린다.
 *
 * 포인터는 split by 선택과 같은 드래그 선택(useDragSelect)을 쓴다. 누른 채 훑으면 지나간 값을
 * 한꺼번에 바꾸고(체크된 값에서 시작하면 해제, 해제된 값에서 시작하면 체크), 누르고 떼면 하나만 바꾼다.
 * 드래그가 다루는 값은 '제외한 값' 목록이다. 키보드 Space는 체크박스가 그대로 처리한다.
 */
export function ValuesFilterBody({
  summary,
  filter,
  disabled,
  onChange,
}: {
  summary: ValuesSummary;
  filter: ExcludeFilter | undefined;
  disabled: boolean;
  onChange: (next: ExcludeFilter | undefined) => void;
}) {
  const [keyword, setKeyword] = useState("");
  /** 드래그 중 미리 보기(제외할 값). 확정 전까지 onChange를 부르지 않는다. */
  const [preview, setPreview] = useState<string[] | null>(null);
  const committed = useMemo(() => filter?.values ?? [], [filter]);
  const excluded = useMemo(
    () => new Set(preview ?? committed),
    [preview, committed],
  );
  const shown = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return k
      ? summary.values.filter((v) => v.value.toLowerCase().includes(k))
      : summary.values;
  }, [summary.values, keyword]);
  const shownValues = useMemo(() => shown.map((v) => v.value), [shown]);
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: shown.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const commit = (next: Set<string>) =>
    onChange(
      next.size === 0
        ? undefined
        : { kind: "exclude", column: summary.column, values: [...next] },
    );
  const isBlocked = useCallback(() => disabled, [disabled]);
  const drag = useDragSelect({
    listRef,
    value: committed,
    visible: shownValues,
    rowHeight: ROW_HEIGHT,
    isBlocked,
    onPreview: setPreview,
    onCommit: (next) => commit(new Set(next)),
  });
  const toggle = (value: string, include: boolean) => {
    const next = new Set(excluded);
    if (include) next.delete(value);
    else next.add(value);
    commit(next);
  };
  /** 검색으로 보이는 값만 한꺼번에 포함 / 제외 */
  const setShown = (include: boolean) => {
    const next = new Set(excluded);
    for (const { value } of shown) {
      if (include) next.delete(value);
      else next.add(value);
    }
    commit(next);
  };

  return (
    <div className="flex flex-col gap-2 text-12">
      <input
        type="search"
        className="rounded-md border border-line bg-elevated px-2 py-1.25 text-12 text-fg"
        placeholder={`${summary.values.length.toLocaleString()}개 값에서 검색`}
        aria-label="값 검색"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={bulkButton}
          disabled={disabled}
          onClick={() => setShown(true)}
        >
          {keyword ? "보이는 값 선택" : "전체 선택"}
        </button>
        <button
          type="button"
          className={bulkButton}
          disabled={disabled}
          onClick={() => setShown(false)}
        >
          {keyword ? "보이는 값 해제" : "전체 해제"}
        </button>
        <span className="ml-auto text-fg-muted">
          {excluded.size > 0
            ? `${excluded.size.toLocaleString()}개 제외`
            : "전부 포함"}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="text-fg-muted">일치하는 값이 없습니다.</p>
      ) : (
        <div
          ref={listRef}
          // 드래그 선택 중 글자가 선택되거나, touch에서 세로 스크롤 외 동작이 끼어들지 않게 한다.
          className="max-h-60 touch-pan-y select-none overflow-y-auto overscroll-contain rounded-md border border-line bg-elevated data-dragging:cursor-ns-resize"
          data-dragging={preview ? "" : undefined}
          {...drag.listProps}
        >
          {/* 전체 높이와 줄 위치는 가상 스크롤이 계산한 값이라 CSS로 정할 수 없다. */}
          <div
            className="relative"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const { value, count } = shown[row.index];
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: onClick은 포인터 클릭의 기본 토글만 막는다. 키보드는 안의 체크박스가 그대로 처리한다.
                <label
                  key={value}
                  // 높이는 ROW_HEIGHT와 같아야 한다.
                  className="absolute top-0 left-0 flex h-6.5 w-full cursor-pointer items-center gap-1.5 px-2 hover:bg-panel"
                  data-index={row.index}
                  style={{ transform: `translateY(${row.start}px)` }}
                  // 포인터 선택은 목록에서 직접 판정하므로 label 클릭의 체크 토글은 막는다.
                  // detail === 0인 click은 키보드(Space)라 그대로 둔다.
                  onClick={(e) => {
                    if (e.detail > 0) e.preventDefault();
                  }}
                >
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={!excluded.has(value)}
                    disabled={disabled}
                    onChange={(e) => toggle(value, e.target.checked)}
                  />
                  <span
                    className="min-w-0 flex-1 truncate text-fg"
                    title={value}
                  >
                    {value}
                  </span>
                  <span className="text-fg-muted">
                    {count.toLocaleString()}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

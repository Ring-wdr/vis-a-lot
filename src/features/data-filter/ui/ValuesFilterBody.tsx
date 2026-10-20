"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import type { ColumnSummary, ExcludeFilter } from "@/shared/api/types";
import styles from "./DataFilter.module.css";

type ValuesSummary = Extract<ColumnSummary, { kind: "values" }>;

const ROW_HEIGHT = 26;

/**
 * 범주 컬럼 필터: 검색(부분 일치) + 가상 스크롤 목록. 처음엔 전부 포함이고, 체크를 풀면 그 값을 뺀다.
 * lot_id처럼 값이 수천 개여도 보이는 줄만 그린다.
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
  const excluded = useMemo(() => new Set(filter?.values), [filter]);
  const shown = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return k
      ? summary.values.filter((v) => v.value.toLowerCase().includes(k))
      : summary.values;
  }, [summary.values, keyword]);
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
    <div className={styles.body}>
      <input
        type="search"
        className={styles.search}
        placeholder={`${summary.values.length.toLocaleString()}개 값에서 검색`}
        aria-label="값 검색"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <div className={styles.bulk}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShown(true)}
        >
          {keyword ? "보이는 값 선택" : "전체 선택"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShown(false)}
        >
          {keyword ? "보이는 값 해제" : "전체 해제"}
        </button>
        <span className={styles.muted}>
          {excluded.size > 0
            ? `${excluded.size.toLocaleString()}개 제외`
            : "전부 포함"}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className={styles.muted}>일치하는 값이 없습니다.</p>
      ) : (
        <div ref={listRef} className={styles.valueList}>
          {/* 전체 높이와 줄 위치는 가상 스크롤이 계산한 값이라 CSS로 정할 수 없다. */}
          <div
            className={styles.valueSizer}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const { value, count } = shown[row.index];
              return (
                <label
                  key={value}
                  className={styles.valueRow}
                  style={{ transform: `translateY(${row.start}px)` }}
                >
                  <input
                    type="checkbox"
                    checked={!excluded.has(value)}
                    disabled={disabled}
                    onChange={(e) => toggle(value, e.target.checked)}
                  />
                  <span className={styles.valueLabel} title={value}>
                    {value}
                  </span>
                  <span className={styles.muted}>{count.toLocaleString()}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

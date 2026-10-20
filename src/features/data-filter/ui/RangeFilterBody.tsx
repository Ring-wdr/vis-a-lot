"use client";

import { Slider } from "@base-ui/react/slider";
import { useEffect, useState } from "react";
import type { ColumnSummary, RangeFilter } from "@/shared/api/types";
import { rangeFilter } from "../model/filters";
import styles from "./DataFilter.module.css";

type RangeSummary = Extract<ColumnSummary, { kind: "range" }>;

const timeFormat = new Intl.DateTimeFormat("ko", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const numberFormat = new Intl.NumberFormat("ko", { maximumFractionDigits: 2 });

function format(type: RangeSummary["type"], value: number) {
  return type === "time"
    ? timeFormat.format(value)
    : numberFormat.format(value);
}

/** 슬라이더 칸 수. 시계열은 1분보다 잘게 나누지 않는다. */
function stepOf(summary: RangeSummary & { min: number; max: number }) {
  const span = summary.max - summary.min;
  if (span <= 0) return 1;
  return summary.type === "time" ? Math.max(60_000, span / 1000) : span / 1000;
}

/**
 * 숫자·시계열 컬럼 필터: 범위 슬라이더 + 범위 반전 + null 포함.
 * 끄는 동안은 화면에만 보여 주고, 손을 뗄 때 필터로 확정한다.
 */
export function RangeFilterBody({
  summary,
  filter,
  disabled,
  onChange,
}: {
  summary: RangeSummary;
  filter: RangeFilter | undefined;
  disabled: boolean;
  onChange: (next: RangeFilter | undefined) => void;
}) {
  const { min, max } = summary;
  const committed: [number, number] = [
    filter?.min ?? min ?? 0,
    filter?.max ?? max ?? 0,
  ];
  const [range, setRange] = useState(committed);
  const inverse = filter?.inverse ?? false;
  const includeNull = filter?.includeNull ?? true;

  // 밖에서 필터가 바뀌면(전체 해제 등) 슬라이더도 맞춘다.
  const [lo, hi] = committed;
  useEffect(() => setRange([lo, hi]), [lo, hi]);

  if (min === null || max === null) {
    return <p className={styles.muted}>값이 없는 컬럼입니다.</p>;
  }
  const bounded = { ...summary, min, max };
  const commit = (next: [number, number], inv = inverse, nulls = includeNull) =>
    onChange(rangeFilter(summary, next, inv, nulls));

  return (
    <div className={styles.body}>
      <div className={styles.rangeValues} aria-live="polite">
        <span>{format(summary.type, range[0])}</span>
        <span>~</span>
        <span>{format(summary.type, range[1])}</span>
      </div>
      <Slider.Root
        className={styles.slider}
        min={min}
        max={max}
        step={stepOf(bounded)}
        value={range}
        disabled={disabled || min === max}
        data-inverse={inverse || undefined}
        onValueChange={(v) => setRange(v as [number, number])}
        onValueCommitted={(v) => commit(v as [number, number])}
      >
        <Slider.Control className={styles.sliderControl}>
          <Slider.Track className={styles.sliderTrack}>
            <Slider.Indicator className={styles.sliderIndicator} />
            <Slider.Thumb
              index={0}
              className={styles.sliderThumb}
              getAriaLabel={() => "최솟값"}
            />
            <Slider.Thumb
              index={1}
              className={styles.sliderThumb}
              getAriaLabel={() => "최댓값"}
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <div className={styles.rangeBounds}>
        <span>{format(summary.type, min)}</span>
        <span>{format(summary.type, max)}</span>
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={inverse}
          disabled={disabled}
          onChange={(e) => commit(range, e.target.checked, includeNull)}
        />
        범위 반전 (범위 밖만 남기기)
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={includeNull}
          disabled={disabled}
          onChange={(e) => commit(range, inverse, e.target.checked)}
        />
        값 없음(null) 포함
        <span className={styles.muted}>
          {summary.nullCount.toLocaleString()}행
        </span>
      </label>
    </div>
  );
}

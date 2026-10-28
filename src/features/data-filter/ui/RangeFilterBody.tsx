"use client";

import { Slider } from "@base-ui/react/slider";
import type { ColumnSummary, RangeFilter } from "@/shared/api/types";
import { defineMessages, localeCached, useT } from "@/shared/lib/i18n";
import { usePendingValue } from "@/shared/lib/use-pending-value";
import { rangeFilter } from "../model/filters";

type RangeSummary = Extract<ColumnSummary, { kind: "range" }>;

const messages = defineMessages({
  ko: {
    noValues: "값이 없는 컬럼입니다.",
    min: "최솟값",
    max: "최댓값",
    inverse: "범위 반전 (범위 밖만 남기기)",
    includeNull: "값 없음(null) 포함",
    rows: (n: string) => `${n}행`,
  },
  en: {
    noValues: "This column has no values.",
    min: "Minimum",
    max: "Maximum",
    inverse: "Invert range (keep only outside)",
    includeNull: "Include missing (null)",
    rows: (n: string) => `${n} rows`,
  },
});

const timeFormat = localeCached(
  (locale) =>
    new Intl.DateTimeFormat(locale, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
);
const numberFormat = localeCached(
  (locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
);

function format(type: RangeSummary["type"], value: number) {
  return type === "datetime"
    ? timeFormat().format(value)
    : numberFormat().format(value);
}

/** 슬라이더 칸 수. 시계열은 1분보다 잘게 나누지 않는다. */
function stepOf(summary: RangeSummary & { min: number; max: number }) {
  const span = summary.max - summary.min;
  if (span <= 0) return 1;
  return summary.type === "datetime"
    ? Math.max(60_000, span / 1000)
    : span / 1000;
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
  // format도 지금 언어로 만들므로 useT가 언어 변경을 구독한다.
  const text = useT(messages);
  const { min, max } = summary;
  const committed: [number, number] = [
    filter?.min ?? min ?? 0,
    filter?.max ?? max ?? 0,
  ];
  // 끄는 동안은 슬라이더에만 보여 주고, 놓으면 필터로 확정한다.
  const [range, drag] = usePendingValue(committed);
  const inverse = filter?.inverse ?? false;
  const includeNull = filter?.includeNull ?? true;

  if (min === null || max === null) {
    return <p className="text-fg-muted">{text.noValues}</p>;
  }
  const bounded = { ...summary, min, max };
  const commit = (next: [number, number], inv = inverse, nulls = includeNull) =>
    onChange(rangeFilter(summary, next, inv, nulls));

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div
        className="flex justify-between gap-1.5 text-fg tabular-nums"
        aria-live="polite"
      >
        <span>{format(summary.type, range[0])}</span>
        <span>~</span>
        <span>{format(summary.type, range[1])}</span>
      </div>
      <Slider.Root
        className="group/slider py-1.5"
        min={min}
        max={max}
        step={stepOf(bounded)}
        value={range}
        disabled={disabled || min === max}
        data-inverse={inverse || undefined}
        onValueChange={(v) => drag.change(v as [number, number])}
        onValueCommitted={(v) =>
          drag.commit(() => commit(v as [number, number]))
        }
      >
        <Slider.Control className="flex h-4 touch-none items-center">
          <Slider.Track className="relative h-1 w-full rounded-xs bg-line group-data-inverse/slider:bg-accent">
            <Slider.Indicator className="h-full rounded-xs bg-accent group-data-inverse/slider:bg-line" />
            <Slider.Thumb
              index={0}
              className="size-3.5 rounded-full border-2 border-accent bg-elevated shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-disabled:border-fg-muted"
              getAriaLabel={() => text.min}
            />
            <Slider.Thumb
              index={1}
              className="size-3.5 rounded-full border-2 border-accent bg-elevated shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-disabled:border-fg-muted"
              getAriaLabel={() => text.max}
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <div className="flex justify-between text-2xs text-fg-muted tabular-nums">
        <span>{format(summary.type, min)}</span>
        <span>{format(summary.type, max)}</span>
      </div>
      <label className="flex items-center gap-1.5 text-fg-secondary">
        <input
          type="checkbox"
          className="accent-accent"
          checked={inverse}
          disabled={disabled}
          onChange={(e) => commit(range, e.target.checked, includeNull)}
        />
        {text.inverse}
      </label>
      <label className="flex items-center gap-1.5 text-fg-secondary">
        <input
          type="checkbox"
          className="accent-accent"
          checked={includeNull}
          disabled={disabled}
          onChange={(e) => commit(range, inverse, e.target.checked)}
        />
        {text.includeNull}
        <span className="text-fg-muted">
          {text.rows(numberFormat().format(summary.nullCount))}
        </span>
      </label>
    </div>
  );
}

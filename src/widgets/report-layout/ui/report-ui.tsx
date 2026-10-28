"use client";

// 활동 보고·현황 보고가 함께 쓰는 조각: 머리 줄(발표 모드), 숫자 칸, 가로 막대, 자리 잡기·오류.

import { Trans, useLingui } from "@lingui/react/macro";
import {
  GalleryHorizontal,
  Presentation,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { usePresentNav } from "@/features/present-mode/model/present-nav";
import { cn, tv } from "@/shared/lib/tw";
import { button } from "@/shared/ui/button";
import { EmptyState, Skeleton } from "@/shared/ui/Loading";
import "../config/messages";

export const report = tv({
  slots: {
    root: "mx-auto flex w-full max-w-280 min-w-0 flex-col gap-4 p-4 md:p-6",
    section:
      "flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-elevated p-4",
    sectionTitle: "text-sm font-semibold",
    tiles: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6",
  },
  variants: {
    present: {
      true: { root: "max-w-320 gap-6 md:p-8", sectionTitle: "text-base" },
    },
  },
});

/** 제목 줄: 제목·부제 + 발표 모드 / 넘겨 보기 */
export function ReportHeader({
  title,
  subtitle,
  slideCount,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  /** 넘겨 볼 게시물 수 (발표 모드에서 버튼에 붙인다) */
  slideCount: number;
  /** 제목 줄 오른쪽에 더 붙일 것 */
  children?: ReactNode;
}) {
  const { present, start, openSlide } = usePresentNav();
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && (
          <p
            className={cn(
              "text-fg-secondary",
              present ? "text-base" : "text-ui",
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div className="ml-auto flex flex-wrap items-end gap-2">
        {children}
        {present ? (
          <button
            type="button"
            className={button({
              variant: "primary",
              class: "whitespace-nowrap",
            })}
            disabled={slideCount === 0}
            onClick={() => openSlide(0)}
          >
            <GalleryHorizontal size={16} aria-hidden="true" />
            <Trans>게시물 넘겨 보기</Trans>
            <span className="tabular-nums">({slideCount})</span>
          </button>
        ) : (
          <button
            type="button"
            className={button({ size: "sm", class: "whitespace-nowrap" })}
            onClick={start}
          >
            <Presentation size={14} aria-hidden="true" />
            <Trans>발표 모드</Trans>
          </button>
        )}
      </div>
    </header>
  );
}

/** 숫자 칸: 이름 + 큰 숫자 + 보조 설명 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: "default" | "danger" | "accent";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-elevated p-3">
      <span className="truncate text-xs text-fg-muted">{label}</span>
      <span
        data-tone={tone}
        className="text-xl font-bold tabular-nums data-[tone=accent]:text-accent data-[tone=danger]:text-danger"
      >
        {value}
        {unit && (
          <span className="ml-0.5 text-xs font-normal text-fg-muted">
            {unit}
          </span>
        )}
      </span>
      {hint && <span className="truncate text-2xs text-fg-muted">{hint}</span>}
    </div>
  );
}

export type BarSegment = { value: number; className: string; label: string };

/** 가로 막대 한 줄: 이름 | 막대(조각 여럿) | 숫자. max에 대한 비율로 그린다 */
export function BarRow({
  label,
  segments,
  max,
  total,
  aside,
}: {
  label: ReactNode;
  segments: BarSegment[];
  max: number;
  total: ReactNode;
  aside?: ReactNode;
}) {
  const sum = segments.reduce((n, s) => n + s.value, 0);
  return (
    <li className="grid grid-cols-[minmax(5rem,9rem)_minmax(0,1fr)_auto] items-center gap-3">
      <span className="min-w-0 truncate">{label}</span>
      <span
        className="flex h-3 min-w-0 overflow-hidden rounded-xs bg-panel"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}
      >
        {segments.map((s) =>
          s.value > 0 ? (
            <span
              key={s.label}
              className={cn("h-full", s.className)}
              style={{ width: `${(s.value / Math.max(max, sum, 1)) * 100}%` }}
              title={`${s.label} ${s.value}`}
            />
          ) : null,
        )}
      </span>
      <span className="flex items-center gap-2 text-xs whitespace-nowrap tabular-nums">
        <span className="font-semibold">{total}</span>
        {aside}
      </span>
    </li>
  );
}

/** 막대 범례 */
export function Legend({
  items,
}: {
  items: { label: string; className: string }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-fg-secondary">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1">
          <span
            className={cn("size-2.5 rounded-xs", i.className)}
            aria-hidden="true"
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-line bg-elevated p-3"
          >
            <Skeleton width={50} />
            <Skeleton width={30} className="h-6" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-elevated p-4">
        <Skeleton width={30} />
        <Skeleton width={90} />
        <Skeleton width={70} />
        <Skeleton width={50} />
      </div>
    </div>
  );
}

export function ReportError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const { t } = useLingui();
  return (
    <EmptyState
      icon={<TriangleAlert size={20} />}
      title={t`보고서를 만들지 못했습니다`}
    >
      <p>{error.message}</p>
      <button
        type="button"
        className={button({ size: "sm", class: "mt-2" })}
        onClick={onRetry}
      >
        <RefreshCw size={14} aria-hidden="true" />
        <Trans context="retry building the report">다시 시도</Trans>
      </button>
    </EmptyState>
  );
}

import type { ReactNode } from "react";
import type { ChartType } from "@/shared/api/types";

/** 차트 종류 버튼 아이콘 (24 x 24). 새 차트는 여기에 그림을 더한다. */
const ICONS: Record<ChartType, ReactNode> = {
  scatter: (
    <g fill="currentColor">
      <circle cx="6" cy="16" r="2" />
      <circle cx="10" cy="10" r="2" />
      <circle cx="15" cy="13" r="2" />
      <circle cx="18" cy="6" r="2" />
    </g>
  ),
  bar: (
    <g fill="currentColor">
      <rect x="4" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="6" width="4" height="14" rx="1" />
      <rect x="16" y="9" width="4" height="11" rx="1" />
    </g>
  ),
  boxplot: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 3v4M8 17v4M16 5v4M16 15v4" />
      <rect x="5" y="7" width="6" height="10" rx="1" />
      <rect x="13" y="9" width="6" height="6" rx="1" />
    </g>
  ),
};

export function ChartIcon({ type }: { type: ChartType }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {ICONS[type]}
    </svg>
  );
}

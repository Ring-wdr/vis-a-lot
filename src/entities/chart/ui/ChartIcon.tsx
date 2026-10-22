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
  line: (
    <path
      d="M3 17l5-6 4 3 4-7 5 5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  sankey: (
    <g>
      <path
        d="M6 6C12 6 12 9 18 9M6 15C12 15 12 7 18 7M6 15C12 15 12 18 18 18"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="3"
      />
      <g fill="currentColor">
        <rect x="3" y="4" width="3" height="5" rx="1" />
        <rect x="3" y="12" width="3" height="8" rx="1" />
        <rect x="18" y="5" width="3" height="6" rx="1" />
        <rect x="18" y="15" width="3" height="5" rx="1" />
      </g>
    </g>
  ),
  heatmap: (
    <g fill="currentColor">
      <rect x="4" y="4" width="4.5" height="4.5" rx="0.8" opacity="0.35" />
      <rect x="9.75" y="4" width="4.5" height="4.5" rx="0.8" />
      <rect x="15.5" y="4" width="4.5" height="4.5" rx="0.8" opacity="0.6" />
      <rect x="4" y="9.75" width="4.5" height="4.5" rx="0.8" opacity="0.8" />
      <rect
        x="9.75"
        y="9.75"
        width="4.5"
        height="4.5"
        rx="0.8"
        opacity="0.45"
      />
      <rect x="15.5" y="9.75" width="4.5" height="4.5" rx="0.8" />
      <rect x="4" y="15.5" width="4.5" height="4.5" rx="0.8" />
      <rect x="9.75" y="15.5" width="4.5" height="4.5" rx="0.8" opacity="0.6" />
      <rect x="15.5" y="15.5" width="4.5" height="4.5" rx="0.8" opacity="0.3" />
    </g>
  ),
  treemap: (
    <g fill="currentColor">
      <rect x="4" y="4" width="9" height="16" rx="1" />
      <rect x="14" y="4" width="6" height="9" rx="1" opacity="0.6" />
      <rect x="14" y="14" width="6" height="6" rx="1" opacity="0.35" />
    </g>
  ),
  candle: (
    <g stroke="currentColor" strokeWidth="1.6">
      <path d="M7 3v18M17 5v14" fill="none" />
      <rect x="4.5" y="7" width="5" height="9" rx="1" fill="currentColor" />
      <rect x="14.5" y="9" width="5" height="6" rx="1" fill="none" />
    </g>
  ),
  gantt: (
    <g fill="currentColor">
      <rect x="3" y="5" width="9" height="3.5" rx="1" />
      <rect x="9" y="10.25" width="10" height="3.5" rx="1" />
      <rect x="6" y="15.5" width="7" height="3.5" rx="1" />
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

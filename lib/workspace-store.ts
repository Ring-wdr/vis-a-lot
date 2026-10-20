"use client";

import { create } from "zustand";
import type { ChartSpec, CreateChartResponse } from "@/server/api/types";
import { DEFAULT_SERIES_COLOR } from "@/server/render/theme";

export const MODES = [
  "normal",
  "zoom",
  "rect",
  "line",
  "freehand",
  "text",
] as const;
export type Mode = (typeof MODES)[number];

export type DrawnChart = CreateChartResponse & { spec: ChartSpec };

type Size = { width: number; height: number };

type WorkspaceState = {
  /** 왼쪽 패널에서 편집 중인 설정. draw를 눌러야 차트에 반영된다. */
  draft: ChartSpec;
  /** 마지막으로 draw한 차트 */
  current?: DrawnChart;
  page: number;
  mode: Mode;
  /** item grid 영역의 크기. draw할 때 item PNG 크기를 정하는 데 쓴다. */
  gridArea?: Size;
  updateDraft: (patch: Partial<ChartSpec>) => void;
  setCurrent: (chart: DrawnChart) => void;
  setPage: (page: number) => void;
  setMode: (mode: Mode) => void;
  setGridArea: (size: Size) => void;
};

export const DEFAULT_SPEC: ChartSpec = {
  rows: 100_000,
  chartType: "scatter",
  x: "ts",
  y: "value",
  splitBy: [],
  splitSeparator: "-",
  tooltip: [],
  grid: { rows: 2, cols: 2 },
  common: { color: DEFAULT_SERIES_COLOR },
};

export const useWorkspace = create<WorkspaceState>((set) => ({
  draft: DEFAULT_SPEC,
  page: 0,
  mode: "normal",
  updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  setCurrent: (current) => set({ current, page: 0 }),
  setPage: (page) => set({ page }),
  setMode: (mode) => set({ mode }),
  setGridArea: (gridArea) => set({ gridArea }),
}));

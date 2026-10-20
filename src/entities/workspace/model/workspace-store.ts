"use client";

import type { ChartSpec, CreateChartResponse } from "@server/api/types";
import { DEFAULT_SERIES_COLOR } from "@server/render/theme";
import { create } from "zustand";

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
  /** item 단위로 다시 그리는 중인 job (item 키 → job id) */
  itemJobs: Record<string, string>;
  /** 이 세션에서 추가한 도형 수. undo는 이 범위 안에서만 된다. */
  undoCounts: Record<string, number>;
  updateDraft: (patch: Partial<ChartSpec>) => void;
  setDraft: (spec: ChartSpec) => void;
  setCurrent: (chart: DrawnChart) => void;
  /** 같은 차트를 새 job으로 다시 그릴 때 (공통 속성 변경). 페이지와 undo 이력은 유지한다. */
  replaceJob: (jobId: string, spec: ChartSpec, page?: number) => void;
  setPage: (page: number) => void;
  setMode: (mode: Mode) => void;
  setGridArea: (size: Size) => void;
  setItemJob: (key: string, jobId: string | undefined) => void;
  changeUndo: (key: string, delta: number | "reset") => void;
};

export const DEFAULT_SPEC: ChartSpec = {
  rows: 100_000,
  chartType: "scatter",
  x: "ts",
  y: "value",
  agg: "avg",
  legend: null,
  splitBy: [],
  splitSeparator: "-",
  tooltip: [],
  grid: { rows: 3, cols: 3 },
  common: { color: DEFAULT_SERIES_COLOR },
};

export const useWorkspace = create<WorkspaceState>((set) => ({
  draft: DEFAULT_SPEC,
  page: 0,
  mode: "normal",
  itemJobs: {},
  undoCounts: {},
  updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  setDraft: (draft) => set({ draft }),
  setCurrent: (current) =>
    set({ current, page: 0, itemJobs: {}, undoCounts: {} }),
  replaceJob: (jobId, spec, page) =>
    set((s) =>
      s.current
        ? {
            current: { ...s.current, jobId, spec },
            itemJobs: {},
            page: page ?? s.page,
          }
        : {},
    ),
  setPage: (page) => set({ page }),
  setMode: (mode) => set({ mode }),
  setGridArea: (gridArea) => set({ gridArea }),
  setItemJob: (key, jobId) =>
    set((s) => {
      const itemJobs = { ...s.itemJobs };
      if (jobId) itemJobs[key] = jobId;
      else delete itemJobs[key];
      return { itemJobs };
    }),
  changeUndo: (key, delta) =>
    set((s) => ({
      undoCounts: {
        ...s.undoCounts,
        [key]:
          delta === "reset" ? 0 : Math.max(0, (s.undoCounts[key] ?? 0) + delta),
      },
    })),
}));

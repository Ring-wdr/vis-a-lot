"use client";

import { createStore } from "zustand";
import type { ChartSpec, CreateChartResponse } from "@/shared/api/types";
import { DEFAULT_DATASET } from "@/shared/config/dataset";
import { DEFAULT_SERIES_COLOR } from "@/shared/lib/palette";

/** 상단 도구 줄의 모드. 그리기 도구는 페인트 모드 안에서 item 왼쪽 위 도구로 고른다. */
export const MODES = ["normal", "pan", "zoom", "paint"] as const;
export type Mode = (typeof MODES)[number];

/** 페인트 모드에서 고르는 그리기 도구 */
export const PAINT_TOOLS = ["rect", "line", "freehand", "text"] as const;
export type PaintTool = (typeof PAINT_TOOLS)[number];

export type DrawnChart = CreateChartResponse & { spec: ChartSpec };

type Size = { width: number; height: number };

export type WorkspaceState = {
  /** 이 작업 상태(탭)의 id. 탭을 오가도 이어지는 mutation을 이 탭 것으로 찾는 데 쓴다. */
  id: string;
  /** 다시 보기 전용 (history). 설정·모드·item 조작을 모두 막는다. */
  readOnly: boolean;
  /** 왼쪽 패널에서 편집 중인 설정. draw를 눌러야 차트에 반영된다. */
  draft: ChartSpec;
  /** 마지막으로 draw한 차트 */
  current?: DrawnChart;
  /** history나 공유 링크의 차트를 이 탭에 다시 그리는 중 */
  opening: boolean;
  page: number;
  /** 크게 보고 있는 item의 전체 순번. null이면 grid를 보여준다. */
  focus: number | null;
  mode: Mode;
  /** 페인트 모드에서 쓰는 그리기 도구. 탭 안의 모든 item이 같은 도구를 쓴다. */
  paintTool: PaintTool;
  /** scatter 툴팁에 가까운 점(x, y, tooltip 컬럼)을 보여줄지. 화면 표시만 바꾸므로 차트 설정(spec)에 넣지 않는다. */
  showNearest: boolean;
  /** item grid 영역의 크기. draw할 때 item PNG 크기를 정하는 데 쓴다. */
  gridArea?: Size;
  /** item 단위로 다시 그리는 중인 job (item 키 → job id) */
  itemJobs: Record<string, string>;
  /** 이 세션에서 추가한 도형 수. undo는 이 범위 안에서만 된다. */
  undoCounts: Record<string, number>;
  /** 이 탭에서 난 오류 중 아직 보여주지 않은 것. 다른 탭을 보는 동안 쌓였다가 돌아오면 뜬다. */
  notices: string[];
  updateDraft: (patch: Partial<ChartSpec>) => void;
  setDraft: (spec: ChartSpec) => void;
  setCurrent: (chart: DrawnChart) => void;
  /** 같은 차트를 새 job으로 다시 그릴 때 (공통 속성 변경). 페이지와 undo 이력은 유지한다. */
  replaceJob: (jobId: string, spec: ChartSpec, page?: number) => void;
  setPage: (page: number) => void;
  setFocus: (focus: number | null) => void;
  setMode: (mode: Mode) => void;
  setPaintTool: (tool: PaintTool) => void;
  setShowNearest: (show: boolean) => void;
  setGridArea: (size: Size) => void;
  setItemJob: (key: string, jobId: string | undefined) => void;
  changeUndo: (key: string, delta: number | "reset") => void;
  notify: (message: string) => void;
};

export const DEFAULT_SPEC: ChartSpec = {
  dataset: DEFAULT_DATASET,
  chartType: "scatter",
  // 컬럼은 데이터마다 달라 비워 두고, 데이터셋 스키마를 받으면 타입에 맞는 첫 컬럼으로 채운다.
  x: "",
  y: "",
  agg: "avg",
  legend: null,
  splitBy: [],
  splitSeparator: "-",
  tooltip: [],
  grid: { rows: 3, cols: 3 },
  common: { color: DEFAULT_SERIES_COLOR },
};

export function createWorkspaceStore({
  readOnly = false,
  draft = DEFAULT_SPEC,
}: {
  readOnly?: boolean;
  draft?: ChartSpec;
} = {}) {
  return createStore<WorkspaceState>((set) => ({
    id: crypto.randomUUID(),
    readOnly,
    draft,
    opening: false,
    page: 0,
    focus: null,
    mode: "normal",
    paintTool: "rect",
    showNearest: true,
    itemJobs: {},
    undoCounts: {},
    notices: [],
    updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
    setDraft: (draft) => set({ draft }),
    setCurrent: (current) =>
      set({ current, page: 0, focus: null, itemJobs: {}, undoCounts: {} }),
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
    setFocus: (focus) => set({ focus }),
    // 다시 보기 전용 화면은 일반 모드(툴팁)만 쓴다.
    setMode: (mode) => set((s) => (s.readOnly ? {} : { mode })),
    setPaintTool: (paintTool) => set({ paintTool }),
    setShowNearest: (showNearest) => set({ showNearest }),
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
            delta === "reset"
              ? 0
              : Math.max(0, (s.undoCounts[key] ?? 0) + delta),
        },
      })),
    notify: (message) => set((s) => ({ notices: [...s.notices, message] })),
  }));
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;

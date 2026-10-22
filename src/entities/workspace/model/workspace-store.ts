"use client";

import { createStore } from "zustand";
import {
  type ChartFeature,
  supports,
} from "@/entities/chart/model/chart-kinds";
import type {
  ChartOptionsBody,
  ChartSpec,
  CreateChartResponse,
} from "@/shared/api/types";
import { DEFAULT_DATASET } from "@/shared/config/dataset";
import { DEFAULT_SERIES_COLOR } from "@/shared/lib/palette";

/** 상단 도구 줄의 모드. 그리기 도구는 페인트 모드 안에서 item 왼쪽 위 도구로 고른다. */
export const MODES = [
  "normal",
  "pan",
  "zoom",
  "rectSelect",
  "lassoSelect",
  "rectDelete",
  "lassoDelete",
  "paint",
] as const;
export type Mode = (typeof MODES)[number];

/** 모드를 쓰려면 차트가 지원해야 하는 기능. 기본 모드는 모든 차트가 쓴다. */
export const MODE_FEATURE: Record<Mode, ChartFeature | null> = {
  normal: null,
  pan: "pan",
  zoom: "zoom",
  rectSelect: "select",
  lassoSelect: "select",
  rectDelete: "delete",
  lassoDelete: "delete",
  paint: "paint",
};

/** 이 차트 종류에서 고를 수 있는 모드인지 */
export function modeSupported(
  mode: Mode,
  chartType: ChartSpec["chartType"] | undefined,
) {
  const feature = MODE_FEATURE[mode];
  return feature === null || supports(chartType, feature);
}

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
  /** 마지막으로 누른 item 키. 차트·데이터 다운로드와 데이터 표가 이 item을 쓴다. */
  selectedItem: string | null;
  mode: Mode;
  /** 페인트 모드에서 쓰는 그리기 도구. 탭 안의 모든 item이 같은 도구를 쓴다. */
  paintTool: PaintTool;
  /** PNG legend 항목 위에 체크박스를 띄울지. 화면 표시만 바꾸므로 차트 설정(spec)에 넣지 않는다. */
  showLegendCheckboxes: boolean;
  /** scatter 툴팁에 가까운 점(x, y, tooltip 컬럼)을 보여줄지. 화면 표시만 바꾸므로 차트 설정(spec)에 넣지 않는다. */
  showNearest: boolean;
  /**
   * 차트 속성 패널에서 마지막으로 고른 item. item 속성과 차트 id를 함께 둔다
   * (다시 draw하면 다른 차트라 쓰지 않는다).
   */
  optionsItem: OptionsItem | null;
  /**
   * 공통 속성을 바꿨지만 아직 서버에 보내지 않았다. 연달아 바꾸면 멈춘 뒤 마지막 값만 한 번 보낸다 (useCommonSync).
   */
  commonDirty: boolean;
  setCommonDirty: (dirty: boolean) => void;
  /** 차트 속성 패널이 편집하는 범위 */
  optionsScope: "common" | "item";
  /** item을 고르고 그 item 범위로 바꾼다. */
  setOptionsItem: (item: OptionsItem) => void;
  setOptionsScope: (scope: "common" | "item") => void;
  /** 고른 item의 속성만 바꾼다 (범위는 그대로) */
  updateOptionsItem: (patch: Partial<OptionsItem>) => void;
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
  setSelectedItem: (key: string | null) => void;
  setMode: (mode: Mode) => void;
  setPaintTool: (tool: PaintTool) => void;
  setShowNearest: (show: boolean) => void;
  toggleLegendCheckboxes: () => void;
  setGridArea: (size: Size) => void;
  setItemJob: (key: string, jobId: string | undefined) => void;
  changeUndo: (key: string, delta: number | "reset") => void;
  notify: (message: string) => void;
};

/** 차트 속성 패널이 편집하는 item */
export type OptionsItem = {
  chartId: string;
  key: string;
  label: string;
  /** item에 따로 정한 속성 (ItemState.options). 패널에서 바꾸면 보내기 전에도 바로 바뀐다. */
  options: ChartOptionsBody | undefined;
  /** 바꿨지만 아직 서버에 보내지 않았다 (useItemOptionsSync) */
  dirty?: boolean;
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
    selectedItem: null,
    mode: "normal",
    paintTool: "rect",
    showNearest: true,
    showLegendCheckboxes: false,
    optionsItem: null,
    optionsScope: "common",
    setOptionsItem: (optionsItem) => set({ optionsItem, optionsScope: "item" }),
    setOptionsScope: (optionsScope) => set({ optionsScope }),
    updateOptionsItem: (patch) =>
      set((s) => ({
        optionsItem: s.optionsItem && { ...s.optionsItem, ...patch },
      })),
    commonDirty: false,
    setCommonDirty: (commonDirty) => set({ commonDirty }),
    itemJobs: {},
    undoCounts: {},
    notices: [],
    updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
    setDraft: (draft) => set({ draft }),
    setCurrent: (current) =>
      set((s) => ({
        current,
        page: 0,
        focus: null,
        selectedItem: null,
        itemJobs: {},
        undoCounts: {},
        // 새 차트가 지원하지 않는 모드(예: pie의 이동)였으면 기본 모드로 돌린다.
        ...(modeSupported(s.mode, current.spec.chartType)
          ? {}
          : { mode: "normal" as const }),
      })),
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
    setSelectedItem: (selectedItem) => set({ selectedItem }),
    // 다시 보기 전용 화면은 일반 모드(툴팁)만 쓴다.
    setMode: (mode) => set((s) => (s.readOnly ? {} : { mode })),
    setPaintTool: (paintTool) => set({ paintTool }),
    setShowNearest: (showNearest) => set({ showNearest }),
    toggleLegendCheckboxes: () =>
      set((s) => ({ showLegendCheckboxes: !s.showLegendCheckboxes })),
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

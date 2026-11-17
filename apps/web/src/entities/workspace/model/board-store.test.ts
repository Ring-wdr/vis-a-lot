import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnalyticsBoard,
  ChartDefaults,
  ChartSpec,
} from "@/shared/api/types";
import { leaf, panelIdsOf, split } from "../lib/layout-tree";
import {
  boardSaveBody,
  createBoardStore,
  selectCanAddPanel,
  selectLayoutLocked,
} from "./board-store";
import type { DrawnChart } from "./workspace-store";

const cancelJob = vi.fn((_jobId: string) => Promise.resolve(undefined));
vi.mock("@/shared/api/api", () => ({
  api: { cancelJob: (jobId: string) => cancelJob(jobId) },
}));

const boardStore = () => createBoardStore(CHART_DEFAULTS as ChartDefaults);
type Store = ReturnType<typeof boardStore>;

/** 칸에 그린 차트를 둔다. */
function draw(store: Store, panelId: string, jobId = `job-${panelId}`) {
  const panel = store.getState().panels[panelId];
  const spec = panel.getState().draft;
  panel.getState().setCurrent({
    chartId: `chart-${panelId}`,
    jobId,
    historyId: "",
    spec,
  } as DrawnChart);
}

beforeEach(() => cancelJob.mockClear());

describe("보드 store", () => {
  it("빈 칸 하나로 시작하고, 칸 store는 grid 1×1·split 없음·history 미기록이다", () => {
    const store = boardStore();
    const { panelIds, panels, activePanelId, layout } = store.getState();
    expect(panelIds).toHaveLength(1);
    expect(layout).toEqual(leaf(activePanelId));
    const panel = panels[activePanelId].getState();
    expect(panel).toMatchObject({ id: activePanelId, kind: "panel" });
    expect(panel.draft).toMatchObject({
      grid: { rows: 1, cols: 1 },
      splitBy: [],
    });
    // 어떤 길로 바꿔도 칸은 split·grid가 생기지 않는다.
    panel.updateDraft({ splitBy: ["factory"], grid: { rows: 3, cols: 3 } });
    expect(panels[activePanelId].getState().draft).toMatchObject({
      grid: { rows: 1, cols: 1 },
      splitBy: [],
    });
  });

  it("칸을 더하면 그 칸을 고르고, 활성 칸의 데이터셋·scatter로 시작한다", () => {
    const store = boardStore();
    const first = store.getState().activePanelId;
    store.getState().panels[first].getState().updateDraft({
      dataset: "iot-1m",
      chartType: "bar",
    });
    const id = store.getState().addPanel();
    const s = store.getState();
    expect(s.activePanelId).toBe(id);
    expect(s.panelIds).toEqual([first, id]);
    expect(s.panels[id ?? ""].getState().draft).toMatchObject({
      dataset: "iot-1m",
      chartType: "scatter",
    });
  });

  it("9칸이면 더 더하지 않는다", () => {
    const store = boardStore();
    for (let i = 0; i < 8; i++)
      expect(store.getState().addPanel()).toBeDefined();
    expect(store.getState().panelIds).toHaveLength(9);
    expect(selectCanAddPanel(store.getState())).toBe(false);
    expect(store.getState().addPanel()).toBeUndefined();
    expect(store.getState().panelIds).toHaveLength(9);
  });

  it("칸을 지우면 job을 취소하고 같은 번호(없으면 앞 번호) 칸을 고른다. 마지막 칸은 지우지 않는다", () => {
    const store = boardStore();
    const a = store.getState().activePanelId;
    const b = store.getState().addPanel() ?? "";
    const c = store.getState().addPanel() ?? "";
    store.getState().activate(b);
    draw(store, b);
    store.getState().removePanel(b);
    expect(cancelJob).toHaveBeenCalledWith(`job-${b}`);
    expect(store.getState().panelIds).toEqual([a, c]);
    expect(store.getState().panels[b]).toBeUndefined();
    expect(store.getState().activePanelId).toBe(c);
    store.getState().removePanel(c);
    expect(store.getState().activePanelId).toBe(a);
    store.getState().removePanel(a);
    expect(store.getState().panelIds).toEqual([a]);
  });

  it("다른 칸을 고르면 최대화가 풀린다", () => {
    const store = boardStore();
    const a = store.getState().activePanelId;
    const b = store.getState().addPanel() ?? "";
    store.getState().setMaximized(a);
    expect(store.getState()).toMatchObject({
      maximizedPanelId: a,
      activePanelId: a,
    });
    store.getState().activate(b);
    expect(store.getState().maximizedPanelId).toBeNull();
  });

  it("preset으로 늘리면 빈 칸을 더하고, 줄이면 뒤 번호 칸을 지우고 연결을 푼다", () => {
    const store = boardStore();
    const a = store.getState().activePanelId;
    store.getState().applyPreset("3x3");
    const nine = store.getState().panelIds;
    expect(nine).toHaveLength(9);
    expect(nine[0]).toBe(a);
    store.getState().setLink(nine[1], { follow: nine[5], mode: "filter" });
    store.getState().setLink(nine[6], { follow: nine[0], mode: "filter" });
    store.getState().activate(nine[8]);
    draw(store, nine[8]);
    store.getState().applyPreset("left-big-2");
    const s = store.getState();
    expect(s.panelIds).toEqual(nine.slice(0, 3));
    expect(Object.keys(s.panels)).toHaveLength(3);
    expect(cancelJob).toHaveBeenCalledWith(`job-${nine[8]}`);
    // 지운 칸을 따르던 연결과 지운 칸의 연결은 풀린다.
    expect(s.links).toEqual({});
    // 활성 칸이 지워지면 남은 마지막 칸을 고른다.
    expect(s.activePanelId).toBe(nine[2]);
  });

  it("그리는 칸이 있으면 레이아웃을 바꾸지 않는다", () => {
    const store = boardStore();
    const a = store.getState().activePanelId;
    const b = store.getState().addPanel() ?? "";
    store.getState().setPanelBusy(b, true);
    expect(selectLayoutLocked(store.getState())).toBe(true);
    const before = store.getState().layout;
    expect(store.getState().addPanel()).toBeUndefined();
    store.getState().removePanel(a);
    store.getState().movePanel(a, b, "left");
    store.getState().applyPreset("2x2");
    store.getState().resizeSplit([], [0.7, 0.3]);
    expect(store.getState().layout).toBe(before);
    // 그리는 중에도 칸은 고를 수 있다.
    store.getState().activate(a);
    expect(store.getState().activePanelId).toBe(a);
    store.getState().setPanelBusy(b, false);
    store.getState().movePanel(a, b, "right");
    expect(store.getState().panelIds).toEqual([b, a]);
  });

  it("크기 조절은 칸 목록 참조를 바꾸지 않는다", () => {
    const store = boardStore();
    store.getState().addPanel();
    const { panelIds } = store.getState();
    store.getState().resizeSplit([], [0.7, 0.3]);
    const s = store.getState();
    expect(s.panelIds).toBe(panelIds);
    expect(s.layout.type === "split" && s.layout.ratios).toEqual([0.7, 0.3]);
  });

  it("모드는 모든 칸에 적용하고, 지원하지 않는 차트를 그린 칸은 기본 모드다", () => {
    const store = boardStore();
    const a = store.getState().activePanelId;
    const b = store.getState().addPanel() ?? "";
    store.getState().panels[b].getState().updateDraft({ chartType: "pie" });
    draw(store, b);
    store.getState().setMode("pan");
    expect(store.getState().panels[a].getState().mode).toBe("pan");
    expect(store.getState().panels[b].getState().mode).toBe("normal");
    // 새 칸은 보드 모드로 시작한다.
    const c = store.getState().addPanel() ?? "";
    expect(store.getState().panels[c].getState().mode).toBe("pan");
  });

  it("저장 모양: 칸 번호 순, 그린 칸은 chartId, 연결", () => {
    const store = boardStore();
    const a = store.getState().activePanelId;
    const b = store.getState().addPanel() ?? "";
    draw(store, a);
    store.getState().setLink(b, { follow: a, mode: "highlight" });
    store.getState().setLink(a, { follow: a, mode: "filter" });
    const body = boardSaveBody(store.getState());
    expect(body.layout).toBe(store.getState().layout);
    expect(body.activePanelId).toBe(b);
    expect(body.panels.map((p) => p.id)).toEqual([a, b]);
    expect(body.panels[0]).toMatchObject({ chartId: `chart-${a}` });
    expect(body.panels[0]).not.toHaveProperty("link");
    expect(body.panels[1]).toMatchObject({ link: { follow: a } });
    expect(body.panels[1]).not.toHaveProperty("chartId");
  });
});

describe("저장한 보드로 채우기", () => {
  const draft = (
    dataset: string,
    chartType: ChartSpec["chartType"],
  ): ChartSpec => ({
    dataset,
    chartType,
    x: "ts",
    y: "value",
    agg: "avg" as const,
    legend: null,
    splitBy: [],
    splitSeparator: " · ",
    tooltip: [],
    grid: { rows: 1, cols: 1 },
    common: { color: "#2a78d6" },
  });
  const saved: AnalyticsBoard = {
    layout: split("horizontal", [leaf("p2"), leaf("p1")]),
    activePanelId: "p1",
    panels: [
      {
        id: "p1",
        draft: draft("iot-1m", "bar"),
        drawn: {
          spec: draft("iot-1m", "line"),
          restore: { all: { shapes: [] } },
        },
      },
      {
        id: "p2",
        draft: draft("iot-100k", "scatter"),
        drawn: { spec: draft("iot-100k", "scatter"), restore: {} },
        link: { follow: "p1", mode: "filter" },
      },
    ],
    updatedAt: 1,
  };

  it("칸·레이아웃·연결을 채우고 그린 칸을 칸 번호 순으로 돌려준다", () => {
    const store = boardStore();
    const reopen = store.getState().hydrate(saved);
    const s = store.getState();
    expect(s.hydrated).toBe(true);
    expect(s.panelIds).toEqual(["p2", "p1"]);
    expect(panelIdsOf(s.layout)).toEqual(["p2", "p1"]);
    expect(s.activePanelId).toBe("p1");
    expect(s.links).toEqual({ p2: { follow: "p1", mode: "filter" } });
    // 저장한 draft를 칸 draft로 둔다. 그린 설정은 다시 열 때 쓴다.
    expect(s.panels.p1.getState().draft.chartType).toBe("bar");
    expect(reopen.map((r) => r.panelId)).toEqual(["p2", "p1"]);
    expect(reopen[1].store).toBe(s.panels.p1);
    expect(reopen[1].drawn.spec.chartType).toBe("line");
  });

  it("한 번 채운 뒤에는 다시 채우지 않는다. 저장한 보드가 없으면 빈 보드 그대로다", () => {
    const store = boardStore();
    const first = store.getState().activePanelId;
    expect(store.getState().hydrate(null)).toEqual([]);
    expect(store.getState()).toMatchObject({
      hydrated: true,
      panelIds: [first],
    });
    expect(store.getState().hydrate(saved)).toEqual([]);
    expect(store.getState().panelIds).toEqual([first]);
  });

  it("비우면 job을 취소하고 빈 칸 하나로 돌아간다", () => {
    const store = boardStore();
    store.getState().hydrate(saved);
    draw(store, "p1");
    store.getState().reset();
    const s = store.getState();
    expect(cancelJob).toHaveBeenCalledWith("job-p1");
    expect(s.panelIds).toHaveLength(1);
    expect(s.links).toEqual({});
    expect(s.hydrated).toBe(true);
  });
});

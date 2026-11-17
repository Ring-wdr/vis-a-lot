// 칸 연결 전파: 따를 칸의 범위가 바뀌면 따르는 칸에 PUT …/link를 보낸다. 한 단계만, 기다렸다가 마지막 것 하나만.

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PANEL_ITEM_KEY } from "@/entities/workspace/lib/panel-link";
import {
  type BoardStore,
  createBoardStore,
} from "@/entities/workspace/model/board-store";
import type { DrawnChart } from "@/entities/workspace/model/workspace-store";
import { ApiRequestError } from "@/shared/api/api";
import type { ChartDefaults, ChartLinkRequest } from "@/shared/api/types";
import { createLinkPropagation } from "./link-propagation";

vi.mock("@/shared/api/api", () => {
  class ApiRequestError extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    ApiRequestError,
    api: { cancelJob: () => Promise.resolve(undefined) },
  };
});

type Call = { chartId: string; link: ChartLinkRequest | null };

let board: BoardStore;
let ids: string[];
let calls: Call[];
/** 다음 응답들 (없으면 다시 그리는 job id를 만들어 준다) */
let replies: (() => Promise<{ jobId: string | null }>)[];
let stop: () => void;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const panel = (n: number) => board.getState().panels[ids[n - 1]];

/** 칸 n에 그린 차트를 둔다. */
function draw(n: number, chartId = `chart-${n}`) {
  const store = panel(n);
  store.getState().setCurrent({
    chartId,
    jobId: `job-${chartId}`,
    historyId: "",
    spec: store.getState().draft,
  } as DrawnChart);
}

/** 칸 n에서 item 조작(선택 등)을 하고 그 다시 그리기가 끝난다. */
function select(n: number, jobId = `sel-${n}-${Math.random()}`) {
  panel(n).getState().setItemJob(PANEL_ITEM_KEY, jobId);
  panel(n).getState().setItemJob(PANEL_ITEM_KEY, undefined);
}

/** 칸 n의 연결 다시 그리기 job이 끝난다. */
function finishLinkJob(n: number) {
  panel(n).getState().setItemJob(PANEL_ITEM_KEY, undefined);
}

function follow(n: number, source: number) {
  board
    .getState()
    .setLink(ids[n - 1], { follow: ids[source - 1], mode: "filter" });
}

beforeEach(() => {
  board = createBoardStore(CHART_DEFAULTS as ChartDefaults);
  board.getState().addPanel();
  board.getState().addPanel();
  ids = board.getState().panelIds;
  calls = [];
  replies = [];
  for (const n of [1, 2, 3]) draw(n);
  follow(2, 1);
  follow(3, 2);
  stop = createLinkPropagation(board, (chartId, link) => {
    calls.push({ chartId, link });
    const reply = replies.shift();
    return reply
      ? reply()
      : Promise.resolve({ jobId: `link-${chartId}-${calls.length}` });
  }).stop;
});

afterEach(() => stop());

describe("칸 연결 전파", () => {
  it("따를 칸의 선택은 따르는 칸 하나만 바꾼다 (한 단계)", async () => {
    select(1);
    await tick();
    expect(calls).toEqual([
      {
        chartId: "chart-2",
        link: {
          source: { chartId: "chart-1", itemKey: PANEL_ITEM_KEY },
          mode: "filter",
        },
      },
    ]);
    // 따르는 칸은 이전 PNG 위에서 다시 그린다 (item 다시 그리기).
    expect(panel(2).getState().itemJobs[PANEL_ITEM_KEY]).toBe("link-chart-2-1");
    // 칸 2의 연결 다시 그리기가 끝나도 칸 2를 따르는 칸 3에는 보내지 않는다.
    finishLinkJob(2);
    await tick();
    expect(calls).toHaveLength(1);
    // 칸 2 자신의 선택은 칸 3에 간다.
    select(2);
    await tick();
    expect(calls.map((c) => c.chartId)).toEqual(["chart-2", "chart-3"]);
    expect(calls[1].link?.source.chartId).toBe("chart-2");
  });

  it("범위를 바꾸지 않는 다시 그리기(확대·크기·색·도형)가 끝나면 보내지 않는다", async () => {
    panel(1).getState().setItemJob(PANEL_ITEM_KEY, "zoom", { look: true });
    panel(1).getState().setItemJob(PANEL_ITEM_KEY, undefined);
    await tick();
    expect(calls).toEqual([]);
    expect(panel(1).getState().lookJobs).toEqual({});
    // 범위를 바꿀 수 있는 조작은 보낸다.
    select(1);
    await tick();
    expect(calls.map((c) => c.chartId)).toEqual(["chart-2"]);
  });

  it("서로 따라도(1 ↔ 2) 연결 다시 그리기가 되돌아 전파되지 않는다", async () => {
    follow(1, 2);
    await tick();
    calls.length = 0;
    select(1);
    await tick();
    expect(calls.map((c) => c.chartId)).toEqual(["chart-2"]);
    finishLinkJob(2);
    await tick();
    expect(calls).toHaveLength(1);
  });

  it("따르는 칸이 그리는 중에 선택을 세 번 바꾸면 끝난 뒤 마지막 것으로 한 번만 보낸다", async () => {
    board.getState().setPanelBusy(ids[1], true);
    select(1);
    select(1);
    // 그사이 따를 칸을 새로 그렸다: 보낼 때의 차트로 만든다.
    draw(1, "chart-1b");
    select(1);
    await tick();
    expect(calls).toEqual([]);
    board.getState().setPanelBusy(ids[1], false);
    await tick();
    expect(calls).toHaveLength(1);
    expect(calls[0].chartId).toBe("chart-2");
    expect(calls[0].link?.source.chartId).toBe("chart-1b");
  });

  it("보내는 중에 다시 바뀌면 응답 뒤 한 번 더 보낸다", async () => {
    let answer!: (value: { jobId: string | null }) => void;
    replies.push(() => new Promise((resolve) => (answer = resolve)));
    select(1);
    await tick();
    select(1);
    select(1);
    await tick();
    expect(calls).toHaveLength(1);
    answer({ jobId: null });
    await tick();
    expect(calls).toHaveLength(2);
  });

  it("따를 칸이 그리는 중이면 범위가 정해진 뒤에 보낸다", async () => {
    board.getState().setPanelBusy(ids[0], true);
    board.getState().setLink(ids[1], { follow: ids[0], mode: "highlight" });
    await tick();
    expect(calls).toEqual([]);
    board.getState().setPanelBusy(ids[0], false);
    await tick();
    expect(calls).toHaveLength(1);
    // 강조를 쓸 수 있는 차트(기본 scatter)라 강조로 보낸다.
    expect(calls[0].link?.mode).toBe("highlight");
  });

  it("따를 칸을 지우면 연결을 풀고 범위를 지운다", async () => {
    board.getState().removePanel(ids[0]);
    await tick();
    expect(board.getState().links[ids[1]]).toBeUndefined();
    expect(calls).toEqual([{ chartId: "chart-2", link: null }]);
  });

  it("연결을 풀면 범위를 지운다", async () => {
    board.getState().setLink(ids[2], null);
    await tick();
    expect(calls).toEqual([{ chartId: "chart-3", link: null }]);
  });

  it("그린 적 없는 칸에는 보내지 않는다 (그릴 때 함께 건다)", async () => {
    const id = board.getState().addPanel() as string;
    board.getState().setLink(id, { follow: ids[0], mode: "filter" });
    select(1);
    await tick();
    expect(calls.map((c) => c.chartId)).toEqual(["chart-2"]);
  });

  it("거절되면(422) 사유를 남기고, 다시 걸리면 지운다", async () => {
    replies.push(() =>
      Promise.reject(new ApiRequestError(422, "연결 컬럼이 없습니다.")),
    );
    select(1);
    await tick();
    expect(board.getState().linkErrors[ids[1]]).toBe("연결 컬럼이 없습니다.");
    select(1);
    await tick();
    expect(board.getState().linkErrors[ids[1]]).toBeUndefined();
  });

  it("보내는 사이 따르는 칸이 그리기 시작해 409면 끝난 뒤 다시 보낸다", async () => {
    replies.push(() => {
      board.getState().setPanelBusy(ids[1], true);
      return Promise.reject(new ApiRequestError(409, "렌더링 중"));
    });
    select(1);
    await tick();
    expect(calls).toHaveLength(1);
    expect(board.getState().linkErrors[ids[1]]).toBeUndefined();
    board.getState().setPanelBusy(ids[1], false);
    await tick();
    expect(calls).toHaveLength(2);
  });

  it("데이터셋이 다른데 연결 컬럼이 없으면 범위를 지우는 요청을 보낸다", async () => {
    panel(2)
      .getState()
      .setCurrent({
        ...(panel(2).getState().current as DrawnChart),
        spec: { ...panel(2).getState().draft, dataset: "other" },
      });
    await tick();
    calls.length = 0;
    // 지울 범위가 없으면 서버는 다시 그리지 않는다.
    replies.push(() => Promise.resolve({ jobId: null }));
    select(1);
    await tick();
    expect(calls).toEqual([{ chartId: "chart-2", link: null }]);
    board.getState().setLink(ids[1], {
      follow: ids[0],
      mode: "filter",
      on: { source: "machine", target: "machine" },
    });
    await tick();
    expect(calls[1].link?.on).toEqual({ source: "machine", target: "machine" });
  });
});

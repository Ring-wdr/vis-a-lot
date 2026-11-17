// @vitest-environment jsdom
// 칸의 job 상태가 보드 store의 busy(레이아웃 잠금)와 하단 줄의 실패 수로 옮겨지는지 본다.

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BoardScope,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import type { BoardStore } from "@/entities/workspace/model/board-store";
import type { DrawnChart } from "@/entities/workspace/model/workspace-store";
import { queryKeys } from "@/shared/api/queries";
import type { ChartDefaults, JobStateResponse } from "@/shared/api/types";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import { usePanelStatus } from "../model/panel-status";
import { PanelJobs } from "./PanelJobs";

vi.mock("@/shared/api/api", async (original) => {
  const mod = await original<typeof import("@/shared/api/api")>();
  return {
    ...mod,
    api: {
      ...mod.api,
      job: () => new Promise(() => {}),
      cancelJob: () => Promise.resolve(undefined),
    },
  };
});

let client: QueryClient;
let board: BoardStore;

function Capture() {
  board = useBoardStore();
  return null;
}

const job = (status: JobStateResponse["status"], failed = 0) =>
  ({
    jobId: "job",
    chartId: "chart",
    version: 1,
    status,
    phase: "render",
    progress: { done: 0, total: 1 },
    totalItems: 1,
    matchedItems: 1,
    page: 0,
    pageSize: 0,
    offset: 0,
    items: [],
    kind: "draw",
    renderWorkers: 1,
    counts: { queued: 0, running: 0, success: 0, failed, cancelled: 0 },
    timing: { createdAt: 0 },
  }) as JobStateResponse;

const setJob = (state: JobStateResponse) =>
  act(async () => {
    client.setQueryData(queryKeys.jobProgress("job"), state);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const busyIds = () => Object.keys(board.getState().busy);
const panelId = () => board.getState().activePanelId;
const panel = () => board.getState().panels[panelId()];

let unmount: () => void;

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  ({ unmount } = renderWithI18n(
    <QueryClientProvider client={client}>
      <BoardScope defaults={CHART_DEFAULTS as ChartDefaults}>
        <Capture />
        <PanelJobs />
      </BoardScope>
    </QueryClientProvider>,
  ));
});

afterEach(cleanup);

describe("칸 job 상태 옮기기", () => {
  it("다시 여는 중·item 다시 그리기 중인 칸을 보드의 busy로 옮긴다", () => {
    expect(busyIds()).toEqual([]);
    act(() => panel().setState({ opening: true }));
    expect(busyIds()).toEqual([panelId()]);
    act(() => panel().setState({ opening: false }));
    expect(busyIds()).toEqual([]);
    act(() => panel().getState().setItemJob("k", "redraw"));
    expect(busyIds()).toEqual([panelId()]);
    act(() => panel().getState().setItemJob("k", undefined));
    expect(busyIds()).toEqual([]);
  });

  it("그리는 job이 끝나면 busy를 풀고, 실패면 실패 수에 넣는다", async () => {
    await setJob(job("progress"));
    act(() =>
      panel()
        .getState()
        .setCurrent({
          chartId: "chart",
          jobId: "job",
          spec: panel().getState().draft,
        } as DrawnChart),
    );
    expect(busyIds()).toEqual([panelId()]);
    await setJob(job("failed"));
    expect(busyIds()).toEqual([]);
    expect(Object.keys(usePanelStatus.getState().failed)).toEqual([panelId()]);
  });

  it("칸마다 따로 옮기고, 화면을 떠나면 푼다", () => {
    let added = "";
    act(() => {
      added = board.getState().addPanel() as string;
    });
    act(() => board.getState().panels[added].setState({ opening: true }));
    expect(busyIds()).toEqual([added]);
    unmount();
    expect(busyIds()).toEqual([]);
    expect(usePanelStatus.getState().failed).toEqual({});
  });
});

// @vitest-environment jsdom
// 작업 store의 어떤 값이 바뀌면 grid와 item이 다시 그려지는지 센다.
// item 하나를 바꿨을 때 다른 item이 다시 그려지면 fine-grained 구독이 깨진 것이다.

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceScope } from "@/entities/workspace/model/workspace-scope";
import {
  createWorkspaceStore,
  type DrawnChart,
  defaultSpec,
  type WorkspaceStore,
} from "@/entities/workspace/model/workspace-store";
import { queryKeys } from "@/shared/api/queries";
import type {
  ChartDefaults,
  ItemState,
  JobStateResponse,
} from "@/shared/api/types";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import { ChartGrid } from "./ChartGrid";

const ITEMS = 9;
const counts = {
  grid: 0,
  detail: 0,
  footer: 0,
  items: new Map<string, number>(),
};

let client: QueryClient;

/**
 * 진행률 long polling 응답이 온 것처럼 query cache를 바꾼다. useJobProgress는 mock하지 않고
 * 실제 react-query(구조 공유·select)를 쓴다. 요청은 끝나지 않게 막아 두었다(api.job).
 */
const progress = {
  set: (next: JobStateResponse) =>
    act(async () => {
      client.setQueryData(queryKeys.jobProgress("job"), next);
      // react-query는 구독자에게 알리는 일을 timer로 미룬다.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }),
};

const item = (i: number): ItemState => ({
  key: `k${i}`,
  label: `item ${i}`,
  status: "success",
  stageProgress: 1,
  image: { url: `/png/${i}`, width: 100, height: 100 },
  revision: 0,
  zoomed: false,
  shapeCount: 0,
  color: "#000",
  customColor: false,
  favorites: [],
  legendGroups: [],
  deletionCount: 0,
});

const jobState = (version: number): JobStateResponse => ({
  jobId: "job",
  chartId: "chart",
  version,
  // 끝나지 않은 job이면 자동 resize를 보내지 않는다.
  status: "progress",
  phase: "render",
  progress: { done: version, total: ITEMS },
  totalItems: ITEMS,
  page: 0,
  pageSize: ITEMS,
  offset: 0,
  items: Array.from({ length: ITEMS }, (_, i) => item(i)),
  kind: "draw",
  renderWorkers: 1,
  counts: { queued: 0, running: 0, success: ITEMS, failed: 0, cancelled: 0 },
  timing: { createdAt: 0 },
});

// 페이지 item 목록은 react-query의 구조 공유처럼 같은 참조를 돌려준다.
const pageJob = jobState(0);

vi.mock("@/shared/api/queries", async (original) => ({
  ...(await original<typeof import("@/shared/api/queries")>()),
  useChartDefaults: () => CHART_DEFAULTS,
  useJob: () => {
    counts.grid++;
    return { data: pageJob, error: null };
  },
  // DrawnItem이 렌더마다 한 번 부른다. item 렌더 수를 여기서 센다.
  useJobItem: (_jobId: string | undefined, key: string) => {
    counts.items.set(key, (counts.items.get(key) ?? 0) + 1);
    return { data: undefined };
  },
  // 크게 보기(DetailView)가 렌더마다 한 번 부른다.
  useJobRange: () => {
    counts.detail++;
    return { data: { offset: 0, items: pageJob.items } };
  },
  useItemMeta: () => ({ data: undefined }),
  useColumns: () => ({ label: (c: string) => c, info: () => undefined }),
}));

// long polling 요청은 끝나지 않는다. 응답은 progress.set으로 넣는다.
vi.mock("@/shared/api/api", async (original) => {
  const mod = await original<typeof import("@/shared/api/api")>();
  return { ...mod, api: { ...mod.api, job: () => new Promise(() => {}) } };
});

// 하단 job 상태 줄은 렌더 횟수만 센다.
vi.mock("./JobStatusBar", () => ({
  JobStatusBar: () => {
    counts.footer++;
    return null;
  },
}));

let store: WorkspaceStore;

function renderGrid() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  client.setQueryData(queryKeys.jobProgress("job"), jobState(0));
  renderWithI18n(
    <QueryClientProvider client={client}>
      <WorkspaceScope store={store}>
        <ChartGrid />
      </WorkspaceScope>
    </QueryClientProvider>,
  );
}

function reset() {
  counts.grid = 0;
  counts.detail = 0;
  counts.footer = 0;
  counts.items.clear();
}

/** 다시 그려진 item 수 */
const itemRenders = () => [...counts.items.values()].reduce((a, b) => a + b, 0);

beforeEach(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  const draft = defaultSpec(CHART_DEFAULTS as ChartDefaults);
  store = createWorkspaceStore({ draft });
  store.setState({
    gridArea: { width: 900, height: 900 },
    current: {
      chartId: "chart",
      jobId: "job",
      spec: draft,
    } as DrawnChart,
  });
  renderGrid();
  reset();
});

afterEach(cleanup);

/** 바꾼 뒤 grid(ChartGrid)와 각 item(DrawnItem)이 다시 그려진 횟수 */
const renders = () => ({
  grid: counts.grid,
  items: Object.fromEntries(counts.items),
});

describe("ChartGrid 렌더 횟수", () => {
  it("처음에는 item을 한 번씩 그린다", () => {
    cleanup();
    reset();
    renderGrid();
    expect(counts.items.size).toBe(ITEMS);
    expect(itemRenders()).toBe(ITEMS);
  });

  it("item 하나를 누르면 그 item만 다시 그린다", () => {
    act(() => store.getState().setSelectedItem("k0"));
    expect(renders()).toEqual({ grid: 0, items: { k0: 1 } });
  });

  it("다른 item을 누르면 전에 누른 item과 새 item만 다시 그린다", () => {
    act(() => store.getState().setSelectedItem("k0"));
    reset();
    act(() => store.getState().setSelectedItem("k1"));
    expect(renders()).toEqual({ grid: 0, items: { k0: 1, k1: 1 } });
  });

  it("item 하나를 다시 그리기 시작해도 다른 item은 다시 그리지 않는다", () => {
    act(() => store.getState().setItemJob("k3", "redraw"));
    expect(renders()).toEqual({ grid: 0, items: { k3: 1 } });
  });

  it("진행률 응답이 오면 하단 상태 줄만 다시 그린다", async () => {
    await progress.set(jobState(1));
    expect(renders()).toEqual({ grid: 0, items: {} });
    expect(counts.footer).toBe(1);
  });

  it("job이 끝나면 grid도 다시 그린다 (상태가 바뀌었다)", async () => {
    await progress.set({ ...jobState(2), status: "success" });
    expect(counts.grid).toBe(1);
    expect(counts.footer).toBe(1);
  });

  it("grid와 상관없는 draft 값을 바꿔도 다시 그리지 않는다", () => {
    act(() => store.getState().updateDraft({ x: "other" }));
    expect(renders()).toEqual({ grid: 0, items: {} });
  });

  it("알림(notices)이 쌓여도 다시 그리지 않는다", () => {
    act(() => store.getState().notify("hello"));
    expect(renders()).toEqual({ grid: 0, items: {} });
  });

  it("grid 영역이 같은 크기로 다시 잡혀도 다시 그리지 않는다", () => {
    act(() => store.getState().setGridArea({ width: 900, height: 900 }));
    expect(renders()).toEqual({ grid: 0, items: {} });
  });

  it("grid 영역 크기가 바뀌면 grid와 item을 한 번씩 다시 그린다", () => {
    act(() => store.getState().setGridArea({ width: 600, height: 600 }));
    expect(counts.grid).toBe(1);
    expect(itemRenders()).toBe(ITEMS);
  });

  it("크게 보는 동안 다른 item을 다시 그려도 크게 보기는 다시 그리지 않는다", () => {
    act(() => store.getState().setFocus(0));
    reset();
    act(() => store.getState().setItemJob("k5", "redraw"));
    expect({ grid: counts.grid, detail: counts.detail }).toEqual({
      grid: 0,
      detail: 0,
    });
  });
});

// @vitest-environment jsdom
// analytics 칸 둘을 나란히 그리고, 한 칸의 job 진행·조작이 다른 칸을 다시 그리지 않는지 센다.

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
import { holdSizes } from "@/shared/lib/size-hold";
import { PanelChart } from "./PanelChart";

const PANELS = ["a", "b"] as const;
type Panel = (typeof PANELS)[number];

/** 칸마다 칸 본문(useJob)과 item 본문(useJobItem)이 그려진 횟수 */
const counts = {
  panel: new Map<string, number>(),
  item: new Map<string, number>(),
};
const bump = (map: Map<string, number>, key: string) =>
  map.set(key, (map.get(key) ?? 0) + 1);

let client: QueryClient;

const item = (panel: string): ItemState => ({
  key: `key-${panel}`,
  label: "전체",
  status: "success",
  stageProgress: 1,
  image: { url: `/png/${panel}`, width: 300, height: 200 },
  revision: 0,
  zoomed: false,
  shapeCount: 0,
  color: "#000",
  customColor: false,
  favorites: [],
  legendGroups: [],
  deletionCount: 0,
});

const jobState = (panel: string, version: number): JobStateResponse => ({
  jobId: `job-${panel}`,
  chartId: `chart-${panel}`,
  version,
  status: "progress",
  phase: "render",
  progress: { done: version, total: 10 },
  totalItems: 1,
  matchedItems: 1,
  page: 0,
  pageSize: 1,
  offset: 0,
  items: [item(panel)],
  kind: "draw",
  renderWorkers: 1,
  counts: { queued: 0, running: 1, success: 0, failed: 0, cancelled: 0 },
  timing: { createdAt: 0 },
});

// 페이지 item 목록은 react-query의 구조 공유처럼 같은 참조를 돌려준다.
const pageJobs = Object.fromEntries(
  PANELS.map((p) => [`job-${p}`, jobState(p, 0)]),
) as Record<string, JobStateResponse>;

vi.mock("@/shared/api/queries", async (original) => ({
  ...(await original<typeof import("@/shared/api/queries")>()),
  useChartDefaults: () => CHART_DEFAULTS,
  // 칸 본문(DrawnPanel)이 렌더마다 한 번 부른다.
  useJob: (jobId: string) => {
    bump(counts.panel, jobId);
    return { data: pageJobs[jobId], error: null };
  },
  // item 본문(DrawnItem)이 렌더마다 한 번 부른다.
  useJobItem: (_jobId: string | undefined, key: string) => {
    bump(counts.item, key);
    return { data: undefined };
  },
  useItemMeta: () => ({ data: undefined }),
  useColumns: () => ({ label: (c: string) => c, info: () => undefined }),
}));

// long polling·크기 맞춤 요청은 끝나지 않는다. 응답은 progress로 넣는다.
vi.mock("@/shared/api/api", async (original) => {
  const mod = await original<typeof import("@/shared/api/api")>();
  return {
    ...mod,
    api: {
      ...mod.api,
      job: () => new Promise(() => {}),
      resizeItems: () => new Promise(() => {}),
    },
  };
});

const stores = {} as Record<Panel, WorkspaceStore>;

const progress = (panel: Panel, version: number) =>
  act(async () => {
    client.setQueryData(
      queryKeys.jobProgress(`job-${panel}`),
      jobState(panel, version),
    );
    // react-query는 구독자에게 알리는 일을 timer로 미룬다.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function reset() {
  counts.panel.clear();
  counts.item.clear();
}

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

  client = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  const draft = defaultSpec(CHART_DEFAULTS as ChartDefaults);
  for (const p of PANELS) {
    const store = createWorkspaceStore({ kind: "panel", id: p, draft });
    store.setState({
      gridArea: { width: 600, height: 400 },
      current: {
        chartId: `chart-${p}`,
        jobId: `job-${p}`,
        spec: store.getState().draft,
      } as DrawnChart,
    });
    stores[p] = store;
    client.setQueryData(queryKeys.jobProgress(`job-${p}`), jobState(p, 0));
  }
  renderWithI18n(
    <QueryClientProvider client={client}>
      {PANELS.map((p) => (
        <WorkspaceScope key={p} store={stores[p]}>
          <PanelChart active={p === "a"} onOpenInGallery={() => {}} />
        </WorkspaceScope>
      ))}
    </QueryClientProvider>,
  );
  reset();
});

afterEach(cleanup);

const renders = () => ({
  panels: Object.fromEntries(counts.panel),
  items: Object.fromEntries(counts.item),
});

describe("PanelChart 렌더 횟수", () => {
  it("처음에는 칸마다 item을 한 번씩 그린다", () => {
    cleanup();
    reset();
    renderWithI18n(
      <QueryClientProvider client={client}>
        {PANELS.map((p) => (
          <WorkspaceScope key={p} store={stores[p]}>
            <PanelChart active={false} onOpenInGallery={() => {}} />
          </WorkspaceScope>
        ))}
      </QueryClientProvider>,
    );
    expect(renders().items).toEqual({ "key-a": 1, "key-b": 1 });
  });

  it("한 칸의 job 진행률 응답은 어느 칸도 다시 그리지 않는다", async () => {
    await progress("a", 1);
    await progress("a", 2);
    expect(renders()).toEqual({ panels: {}, items: {} });
  });

  it("한 칸의 item 다시 그리기는 그 칸의 item만 다시 그린다", () => {
    act(() => stores.a.getState().setItemJob("key-a", "redraw"));
    expect(renders()).toEqual({ panels: {}, items: { "key-a": 1 } });
  });

  it("한 칸의 draft를 고쳐도 어느 칸도 다시 그리지 않는다", () => {
    act(() => stores.a.getState().updateDraft({ x: "temperature" }));
    expect(renders()).toEqual({ panels: {}, items: {} });
  });

  it("한 칸의 job이 끝나면 그 칸만 다시 그린다", async () => {
    await act(async () => {
      client.setQueryData(queryKeys.jobProgress("job-a"), {
        ...jobState("a", 3),
        status: "success",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(counts.panel.get("job-b")).toBeUndefined();
    expect(counts.item.get("key-b")).toBeUndefined();
  });
});

describe("PanelChart 칸 크기", () => {
  it("경계를 끄는 동안(크기 쓰기를 미룸)에는 칸 크기를 쓰지 않고, 풀리면 마지막 크기를 한 번 쓴다", () => {
    cleanup();
    const observers: ResizeObserverCallback[] = [];
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        observers.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      renderWithI18n(
        <QueryClientProvider client={client}>
          <WorkspaceScope store={stores.a}>
            <PanelChart active onOpenInGallery={() => {}} />
          </WorkspaceScope>
        </QueryClientProvider>,
      );
      const resized = (width: number, height: number) =>
        act(() => {
          for (const callback of observers)
            callback(
              [{ contentRect: { width, height } } as ResizeObserverEntry],
              {} as ResizeObserver,
            );
        });
      const writes = vi.fn();
      stores.a.subscribe((s, prev) => {
        if (s.gridArea !== prev.gridArea) writes(s.gridArea);
      });
      const release = holdSizes();
      resized(500, 400);
      resized(450, 400);
      expect(writes).not.toHaveBeenCalled();
      act(release);
      expect(writes).toHaveBeenCalledTimes(1);
      expect(writes).toHaveBeenLastCalledWith({ width: 450, height: 400 });
      // 미루지 않을 때는 바로 쓴다. 숨긴 칸(크기 0)은 쓰지 않는다.
      resized(0, 0);
      resized(420, 400);
      expect(writes).toHaveBeenCalledTimes(2);
      expect(writes).toHaveBeenLastCalledWith({ width: 420, height: 400 });
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});

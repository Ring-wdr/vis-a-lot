// @vitest-environment jsdom
// 탭 상태·탭별 작업 상태가 바뀌면 각 탭 이름이 다시 그려지는지 센다.
// 탭 하나를 바꿨을 때 다른 탭 이름이 다시 그려지면 fine-grained 구독이 깨진 것이다.

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TabsScope,
  useTabs,
  useTabsStore,
} from "@/entities/workspace/model/tabs-scope";
import type {
  TabsStore,
  WorkspaceTab,
} from "@/entities/workspace/model/tabs-store";
import { WorkspaceScope } from "@/entities/workspace/model/workspace-scope";
import type { ChartDefaults } from "@/shared/api/types";
import { TabBar } from "./TabBar";

/** 탭 이름(TabLabel)이 렌더마다 한 번 부르는 useColumns를 데이터셋별로 센다. 탭마다 데이터셋을 다르게 둔다. */
const labels = new Map<string, number>();

vi.mock("@/shared/api/queries", () => ({
  useColumns: (dataset: string) => {
    labels.set(dataset, (labels.get(dataset) ?? 0) + 1);
    return { label: (c: string) => c };
  },
  useDatasetNames: () => (id: string) => id,
}));

let tabs: TabsStore;
let tab: Record<"a" | "b" | "c", WorkspaceTab>;

/** Workspace처럼 보고 있는 탭의 작업 상태로 탭 줄을 감싼다. */
function Bar() {
  tabs = useTabsStore();
  const active = useTabs((s) => s.tabs.find((t) => t.id === s.active.gallery));
  if (!active) return null;
  return (
    <WorkspaceScope store={active.store}>
      <TabBar view="gallery" />
    </WorkspaceScope>
  );
}

beforeEach(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom에는 CSS.escape가 없다. 탭 id(uuid)는 그대로 써도 된다.
  globalThis.CSS ??= { escape: (s: string) => s } as unknown as typeof CSS;
  Element.prototype.scrollIntoView ??= () => {};

  render(
    <TabsScope
      defaults={CHART_DEFAULTS as ChartDefaults}
      initialView={() => "gallery"}
    >
      <Bar />
    </TabsScope>,
  );
  act(() => {
    const s = tabs.getState();
    const a = s.tabs[0];
    a.store.getState().updateDraft({ dataset: "a" });
    const b = s.openGallery({ dataset: "b" });
    const c = s.openGallery({ dataset: "c" });
    if (!b || !c) throw new Error("탭을 열지 못했습니다");
    tab = { a, b, c };
  });
  labels.clear();
});

afterEach(cleanup);

/** 바꾼 뒤 다시 그려진 탭 이름 (데이터셋 → 횟수) */
const renders = () => Object.fromEntries(labels);

describe("TabBar 렌더 횟수", () => {
  it("다른 탭의 작업 상태에서 이름과 상관없는 값을 바꾸면 아무 탭도 다시 그리지 않는다", () => {
    act(() => tab.b.store.getState().updateDraft({ x: "other" }));
    act(() => tab.b.store.getState().setPage(3));
    expect(renders()).toEqual({});
  });

  it("탭 하나의 데이터를 바꾸면 그 탭 이름만 다시 그린다", () => {
    act(() => tab.b.store.getState().updateDraft({ dataset: "b2" }));
    expect(renders()).toEqual({ b2: 1 });
  });

  it("다른 탭으로 가면 탭 이름은 다시 그리지 않는다", () => {
    act(() => tabs.getState().activate(tab.a.id));
    expect(renders()).toEqual({});
  });

  it("탭을 잠가도 탭 이름은 다시 그리지 않는다", () => {
    act(() => tabs.getState().setLocked(true));
    expect(renders()).toEqual({});
  });

  it("새 탭을 열면 새 탭 이름만 그린다", () => {
    act(() => {
      tabs.getState().openGallery({ dataset: "d" });
    });
    expect(renders()).toEqual({ d: 1 });
  });

  it("필터 패널을 열고 닫아도 탭 이름은 다시 그리지 않는다", () => {
    act(() => tabs.getState().toggleFilterPanel());
    expect(renders()).toEqual({});
  });
});

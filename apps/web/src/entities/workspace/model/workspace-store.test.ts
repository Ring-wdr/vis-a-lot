import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { describe, expect, it } from "vitest";
import { type ChartDefaults, NO_SEARCH } from "@/shared/api/types";
import {
  createWorkspaceStore,
  type DrawnChart,
  defaultSpec,
  modeSupported,
} from "./workspace-store";

describe("modeSupported", () => {
  it("기본 모드는 모든 차트에서 고른다", () => {
    expect(modeSupported("normal", { chartType: "bar" })).toBe(true);
  });

  it("차트 종류가 지원하지 않는 기능의 모드는 고르지 않는다", () => {
    expect(modeSupported("rectDelete", { chartType: "boxplot" })).toBe(false);
    expect(modeSupported("pan", { chartType: "sankey" })).toBe(false);
    expect(
      modeSupported("lassoDelete", { chartType: "line", subType: "ecdf" }),
    ).toBe(false);
  });
});

describe("item 검색 조건", () => {
  const draft = defaultSpec(CHART_DEFAULTS as ChartDefaults);
  const chart = { chartId: "c", jobId: "j", spec: draft } as DrawnChart;

  it("조건을 바꾸면 첫 페이지 grid로 돌아간다", () => {
    const store = createWorkspaceStore({ draft });
    store.setState({ current: chart, page: 4, focus: 37 });
    store.getState().setSearch([{ keyword: "a", match: "contains" }]);
    const { search, page, focus } = store.getState();
    expect(search).toEqual([{ keyword: "a", match: "contains" }]);
    expect({ page, focus }).toEqual({ page: 0, focus: null });
  });

  it("조건을 모두 지우면 빈 조건의 참조를 하나로 둔다", () => {
    const store = createWorkspaceStore({ draft });
    store.getState().setSearch([{ keyword: "a", match: "contains" }]);
    store.getState().setSearch([]);
    expect(store.getState().search).toBe(NO_SEARCH);
  });

  it("새로 draw하면 조건을 지운다. 같은 차트를 새 job으로 바꿀 때는 둔다", () => {
    const store = createWorkspaceStore({ draft });
    store.getState().setCurrent(chart);
    const search = [{ keyword: "a", match: "exact" as const }];
    store.getState().setSearch(search);
    store.getState().replaceJob("j2", draft);
    expect(store.getState().search).toBe(search);
    store.getState().setCurrent({ ...chart, jobId: "j3" });
    expect(store.getState().search).toBe(NO_SEARCH);
  });
});

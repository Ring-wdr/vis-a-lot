import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { describe, expect, it } from "vitest";
import type { ChartDefaults } from "@/shared/api/types";
import { createTabsStore } from "./tabs-store";

const tabsStore = () => createTabsStore(CHART_DEFAULTS as ChartDefaults);

describe("tabs store", () => {
  it("처음에는 아무 화면도 고르지 않은 시작 화면이다", () => {
    const store = tabsStore();
    expect(store.getState().view).toBeNull();
    store.getState().setView("gallery");
    expect(store.getState().view).toBe("gallery");
  });

  it("지운 history를 보던 탭을 닫고 남은 history 탭으로 간다", () => {
    const store = tabsStore();
    const a = store.getState().openHistory("a");
    const b = store.getState().openHistory("b");
    expect(store.getState().active.history).toBe(b?.tab.id);
    store.getState().closeHistory("b");
    const { tabs, active } = store.getState();
    expect(tabs.some((t) => t.historyId === "b")).toBe(false);
    expect(active.history).toBe(a?.tab.id);
  });
});

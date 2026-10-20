"use client";

// 작업 탭. gallery 탭은 각자 데이터·설정·차트를 가진 작업 공간이고, history 탭은 연 history 한 건이다.
// 탭마다 작업 store를 하나씩 가지므로 탭을 오가도 그리던 차트와 진행 상태가 그대로 남는다.

import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { ChartSpec } from "@/shared/api/types";
import {
  createWorkspaceStore,
  DEFAULT_SPEC,
  type WorkspaceStore,
} from "./workspace-store";

export const VIEWS = ["gallery", "history"] as const;
export type View = (typeof VIEWS)[number];

export type WorkspaceTab = {
  id: string;
  view: View;
  store: WorkspaceStore;
  /** history 탭이 보여주는 history id */
  historyId?: string;
};

type TabsState = {
  view: View;
  tabs: WorkspaceTab[];
  /** view별로 마지막에 보던 탭 */
  active: Record<View, string | undefined>;
  setView: (view: View) => void;
  activate: (id: string) => void;
  /** 새 gallery 탭을 열고 그 탭으로 간다. */
  openGallery: (draft?: Partial<ChartSpec>) => WorkspaceTab;
  /** history 한 건을 탭으로 연다. 이미 열려 있으면 그 탭으로 간다. created면 새로 그려야 한다. */
  openHistory: (historyId: string) => { tab: WorkspaceTab; created: boolean };
  close: (id: string) => void;
};

function galleryTab(draft?: Partial<ChartSpec>): WorkspaceTab {
  return {
    id: crypto.randomUUID(),
    view: "gallery",
    store: createWorkspaceStore({ draft: { ...DEFAULT_SPEC, ...draft } }),
  };
}

const first = galleryTab();

export const tabsStore = createStore<TabsState>((set, get) => ({
  view: "gallery",
  tabs: [first],
  active: { gallery: first.id, history: undefined },
  setView: (view) => set({ view }),
  activate: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (tab)
      set((s) => ({ view: tab.view, active: { ...s.active, [tab.view]: id } }));
  },
  openGallery: (draft) => {
    const tab = galleryTab(draft);
    set((s) => ({
      tabs: [...s.tabs, tab],
      view: "gallery",
      active: { ...s.active, gallery: tab.id },
    }));
    return tab;
  },
  openHistory: (historyId) => {
    const existing = get().tabs.find((t) => t.historyId === historyId);
    if (existing) {
      get().activate(existing.id);
      return { tab: existing, created: false };
    }
    const tab: WorkspaceTab = {
      id: crypto.randomUUID(),
      view: "history",
      store: createWorkspaceStore({ readOnly: true }),
      historyId,
    };
    set((s) => ({
      tabs: [...s.tabs, tab],
      view: "history",
      active: { ...s.active, history: tab.id },
    }));
    return { tab, created: true };
  },
  close: (id) =>
    set((s) => {
      const tab = s.tabs.find((t) => t.id === id);
      if (!tab) return {};
      const siblings = s.tabs.filter((t) => t.view === tab.view);
      // gallery는 작업 공간이 하나는 있어야 한다.
      if (tab.view === "gallery" && siblings.length === 1) return {};
      const index = siblings.indexOf(tab);
      const rest = siblings.filter((t) => t.id !== id);
      const next =
        s.active[tab.view] === id
          ? (rest[Math.min(index, rest.length - 1)]?.id ?? undefined)
          : s.active[tab.view];
      return {
        tabs: s.tabs.filter((t) => t.id !== id),
        active: { ...s.active, [tab.view]: next },
      };
    }),
}));

export function useTabs<T>(selector: (s: TabsState) => T) {
  return useStore(tabsStore, selector);
}

/** history 탭이 하나도 없을 때 화면이 쓰는 빈 보기 전용 작업 상태 */
export const emptyHistoryStore = createWorkspaceStore({ readOnly: true });

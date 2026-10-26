"use client";

// 작업 탭. gallery 탭은 각자 데이터·설정·차트를 가진 작업 공간이고, history 탭은 연 history 한 건이다.
// 탭마다 작업 store를 하나씩 가지므로 탭을 오가도 그리던 차트와 진행 상태가 그대로 남는다.
// 탭은 로그인한 세션의 것이라 store를 모듈 전역에 두지 않고 세션마다 TabsScope가 새로 만든다.

import { createStore } from "zustand/vanilla";
import { api } from "@/shared/api/api";
import type { ChartDefaults, ChartSpec } from "@/shared/api/types";
import {
  createWorkspaceStore,
  defaultSpec,
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

/** 탭을 잠갔을 때 탭·화면 전환 버튼에 보여주는 안내 */
export const TABS_LOCKED_HINT =
  "그리는 중에는 탭을 바꿀 수 없습니다. cancel을 누르거나 끝날 때까지 기다려 주세요.";

export type TabsState = {
  /** 고른 화면. 처음 들어오면 아무 화면도 고르지 않은 시작 화면(null)이다. */
  view: View | null;
  tabs: WorkspaceTab[];
  /** view별로 마지막에 보던 탭 */
  active: Record<View, string | undefined>;
  /** history 탭이 하나도 없을 때 화면이 쓰는 빈 보기 전용 작업 상태 */
  emptyHistory: WorkspaceStore;
  /**
   * 보고 있는 gallery 탭이 그리는 중이다. 이때는 cancel하거나 끝나기 전까지 탭을 열고 닫거나 바꿀 수 없다.
   * 그리는 중인 탭을 두고 떠나면 진행 상황을 놓치고, 다른 탭의 draw와 render worker를 나눠 쓰게 된다.
   */
  locked: boolean;
  setLocked: (locked: boolean) => void;
  setView: (view: View) => void;
  activate: (id: string) => void;
  /** 새 gallery 탭을 열고 그 탭으로 간다. 잠겨 있으면 열지 않는다. */
  openGallery: (draft?: Partial<ChartSpec>) => WorkspaceTab | undefined;
  /**
   * history 한 건을 탭으로 연다. 이미 열려 있으면 그 탭으로 간다. created면 새로 그려야 한다.
   * 잠겨 있으면 열지 않는다.
   */
  openHistory: (
    historyId: string,
  ) => { tab: WorkspaceTab; created: boolean } | undefined;
  close: (id: string) => void;
  /** 지운 history를 보던 탭을 닫는다. */
  closeHistory: (historyId: string) => void;
  /** 오른쪽 필터 패널. 탭을 바꿔도 열고 닫은 상태는 그대로 둔다. */
  filterPanelOpen: boolean;
  toggleFilterPanel: () => void;
};

/** 서버 기본값(GET /defaults)으로 새 탭의 draft를 만든다. */
export function createTabsStore(defaults: ChartDefaults) {
  const base = defaultSpec(defaults);
  const galleryTab = (draft?: Partial<ChartSpec>): WorkspaceTab => ({
    id: crypto.randomUUID(),
    view: "gallery",
    store: createWorkspaceStore({ draft: { ...base, ...draft } }),
  });
  const readOnlyStore = () =>
    createWorkspaceStore({ readOnly: true, draft: base });
  const first = galleryTab();
  return createStore<TabsState>((set, get) => ({
    view: null,
    tabs: [first],
    active: { gallery: first.id, history: undefined },
    emptyHistory: readOnlyStore(),
    locked: false,
    setLocked: (locked) => set({ locked }),
    setView: (view) => {
      if (!get().locked) set({ view });
    },
    filterPanelOpen: false,
    toggleFilterPanel: () =>
      set((s) => ({ filterPanelOpen: !s.filterPanelOpen })),
    activate: (id) => {
      if (get().locked) return;
      const tab = get().tabs.find((t) => t.id === id);
      if (tab)
        set((s) => ({
          view: tab.view,
          active: { ...s.active, [tab.view]: id },
        }));
    },
    openGallery: (draft) => {
      if (get().locked) return undefined;
      const tab = galleryTab(draft);
      set((s) => ({
        tabs: [...s.tabs, tab],
        view: "gallery",
        active: { ...s.active, gallery: tab.id },
      }));
      return tab;
    },
    openHistory: (historyId) => {
      if (get().locked) return undefined;
      const existing = get().tabs.find((t) => t.historyId === historyId);
      if (existing) {
        get().activate(existing.id);
        return { tab: existing, created: false };
      }
      const tab: WorkspaceTab = {
        id: crypto.randomUUID(),
        view: "history",
        store: readOnlyStore(),
        historyId,
      };
      set((s) => ({
        tabs: [...s.tabs, tab],
        view: "history",
        active: { ...s.active, history: tab.id },
      }));
      return { tab, created: true };
    },
    close: (id) => {
      const s = get();
      if (s.locked) return;
      const tab = s.tabs.find((t) => t.id === id);
      if (!tab) return;
      const siblings = s.tabs.filter((t) => t.view === tab.view);
      // gallery는 작업 공간이 하나는 있어야 한다.
      if (tab.view === "gallery" && siblings.length === 1) return;
      const index = siblings.indexOf(tab);
      const rest = siblings.filter((t) => t.id !== id);
      const next =
        s.active[tab.view] === id
          ? (rest[Math.min(index, rest.length - 1)]?.id ?? undefined)
          : s.active[tab.view];
      set({
        tabs: s.tabs.filter((t) => t.id !== id),
        active: { ...s.active, [tab.view]: next },
      });
      // 아무도 보지 않을 차트를 계속 그리지 않도록 남은 item을 취소한다. 끝난 job이면 서버가 무시한다.
      const jobId = tab.store.getState().current?.jobId;
      if (jobId) api.cancelJob(jobId).catch(() => {});
    },
    closeHistory: (historyId) => {
      // 잠금과 상관없이 닫는다. 지운 history는 다시 볼 수 없다.
      set((s) => {
        const tabs = s.tabs.filter((t) => t.historyId !== historyId);
        if (tabs.length === s.tabs.length) return s;
        const active = s.active.history;
        const keep = tabs.some((t) => t.id === active);
        return {
          tabs,
          active: {
            ...s.active,
            history: keep
              ? active
              : tabs.filter((t) => t.view === "history").at(-1)?.id,
          },
        };
      });
    },
  }));
}

export type TabsStore = ReturnType<typeof createTabsStore>;

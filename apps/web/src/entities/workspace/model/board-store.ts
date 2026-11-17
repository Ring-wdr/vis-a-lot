"use client";

// analytics 보드. 칸(panel)마다 작업 store(kind "panel")를 하나씩 들고, 칸 배치는 레이아웃 트리로 둔다.
// 칸을 WorkspaceScope로 감싸면 gallery의 왼쪽 패널·도구·item 조작이 그 칸을 대상으로 그대로 돈다.
// 보드는 로그인한 세션의 것이라 store를 모듈 전역에 두지 않고 세션마다 BoardScope가 만든다.
// `/`와 `/analytics`를 오가도 남고, 서버에서는 /analytics를 처음 열 때 한 번 받아 채운다(hydrate).

import { createStore } from "zustand/vanilla";
import { api } from "@/shared/api/api";
import type {
  AnalyticsBoard,
  AnalyticsDrawn,
  AnalyticsPanelLink,
  ChartDefaults,
  ChartSpec,
  SaveAnalyticsBoardRequest,
} from "@/shared/api/types";
import {
  type LayoutPresetId,
  applyPreset as presetApplied,
} from "../lib/layout-presets";
import {
  addPanel as addLeaf,
  type DropEdge,
  type LayoutNode,
  leaf,
  MAX_PANELS,
  movePanel as moveLeaf,
  type NodePath,
  normalizeLayout,
  panelIdsOf,
  removePanel as removeLeaf,
  setSplitRatios,
} from "../lib/layout-tree";
import {
  createWorkspaceStore,
  defaultSpec,
  type Mode,
  modeSupported,
  type WorkspaceStore,
} from "./workspace-store";

/** 다시 열 칸: 저장한 보드에서 그린 적이 있는 칸. 화면이 칸 크기를 안 뒤 이 설정으로 다시 그린다. */
export type PanelToReopen = {
  panelId: string;
  store: WorkspaceStore;
  drawn: AnalyticsDrawn;
};

export type BoardState = {
  /** 칸 배치. 바꾸는 action은 늘 정규화한 트리를 둔다. */
  layout: LayoutNode;
  /**
   * 칸 id를 칸 번호 순(트리를 깊이 우선으로 읽은 순서)으로. layout이 바뀔 때만 새 배열이 된다.
   * 번호는 index + 1이다. 목록을 그리는 쪽은 이 배열을 구독하고 칸 id만 넘긴다.
   */
  panelIds: string[];
  /** 칸 id → 그 칸의 작업 store. store 참조는 칸이 있는 동안 바뀌지 않는다. */
  panels: Record<string, WorkspaceStore>;
  /** 고른 칸. 왼쪽 패널·필터 서랍·차트 도구·공유가 이 칸을 대상으로 한다. 늘 있는 칸이다. */
  activePanelId: string;
  /** 보드 전체에 크게 보이는 칸. 다른 칸을 고르거나 레이아웃을 바꾸면 풀린다. */
  maximizedPanelId: string | null;
  /**
   * 그리는 중인 칸 (칸 id → true). 칸마다 작은 컴포넌트가 자기 job 상태를 읽어 setPanelBusy로 옮긴다.
   * 하나라도 있으면 레이아웃을 바꾸는 action(칸 추가·삭제, 옮기기, 크기 조절, preset)을 받지 않는다.
   */
  busy: Record<string, true>;
  /** 보드의 모드. 모든 칸에 적용하고, 칸의 차트가 지원하지 않으면 그 칸만 기본 모드다. */
  mode: Mode;
  /** 칸 연결 (칸 id → 따를 칸). 둘째 PR에서 쓴다. 저장 모양만 지금 맞춰 둔다. */
  links: Record<string, AnalyticsPanelLink>;
  /** 서버에 저장한 보드를 받아 채웠는지 (없어서 빈 보드로 시작한 것도 포함). 세션 동안 다시 받지 않는다. */
  hydrated: boolean;

  /** 칸을 고른다. 다른 칸을 고르면 최대화가 풀린다. */
  activate: (panelId: string) => void;
  /**
   * 칸을 더하고 그 칸을 고른다. 새 칸은 활성 칸의 데이터셋으로 시작하고 차트는 scatter다 (draft로 덮어쓸 수 있다).
   * 9칸이거나 그리는 칸이 있으면 더하지 않고 undefined
   */
  addPanel: (draft?: Partial<ChartSpec>) => string | undefined;
  /**
   * 칸을 지우고 그 칸의 job을 취소한다. 마지막 칸이거나 그리는 칸이 있으면 지우지 않는다.
   * 활성 칸이었으면 같은 번호(없으면 앞 번호) 칸을 고른다. 그린 차트가 있을 때의 확인은 화면이 먼저 받는다.
   */
  removePanel: (panelId: string) => void;
  /** 칸을 대상 칸의 edge 쪽으로 옮긴다 (layout-tree의 movePanel). 그리는 칸이 있으면 받지 않는다. */
  movePanel: (panelId: string, targetId: string, edge: DropEdge) => void;
  /** path의 split 비율을 바꾼다 (크기 조절을 놓을 때 한 번). 그리는 칸이 있으면 받지 않는다. */
  resizeSplit: (path: NodePath, ratios: readonly number[]) => void;
  /**
   * preset을 적용한다. 모자라면 빈 칸을 더하고, 남으면 뒤 번호 칸부터 지운다(job 취소, 그 칸을 따르던 연결을 푼다).
   * 그린 칸이 지워질 때의 확인은 화면이 panelsRemovedByPreset으로 먼저 받는다. 그리는 칸이 있으면 받지 않는다.
   */
  applyPreset: (id: LayoutPresetId) => void;
  /** 이 칸만 크게 보이거나(최대화) 되돌린다. null이면 되돌린다. 최대화한 칸을 고른다. */
  setMaximized: (panelId: string | null) => void;
  /** 칸의 그리는 중 여부. 칸의 job 상태를 보는 컴포넌트가 부른다. */
  setPanelBusy: (panelId: string, busy: boolean) => void;
  /** 보드의 모드를 바꾸고 모든 칸에 적용한다 (그 칸의 차트가 지원하지 않으면 기본 모드). */
  setMode: (mode: Mode) => void;
  /** 칸 연결을 걸거나(link) 푼다(null). 자기 자신이나 없는 칸은 따를 수 없다. */
  setLink: (panelId: string, link: AnalyticsPanelLink | null) => void;
  /**
   * 서버에서 받은 보드로 채운다. null이면(저장한 보드가 없음) 지금 빈 보드 그대로 둔다.
   * 이미 채웠으면 아무것도 하지 않고 빈 배열이다. 그린 적이 있는 칸을 돌려준다: 화면이 칸 크기를 안 뒤
   * openChartIn(store, { spec: drawn.spec, restore: drawn.restore, keepDraft: true })로 다시 그린다.
   */
  hydrate: (board: AnalyticsBoard | null) => PanelToReopen[];
  /** 보드 비우기: 모든 칸의 job을 취소하고 빈 칸 하나로 되돌린다. 서버 쪽 삭제는 화면이 따로 부른다. */
  reset: () => void;
};

/** 레이아웃을 바꾸는 action을 막는지 (그리는 칸이 있다). 막힌 이유는 화면이 title로 알린다. */
export const selectLayoutLocked = (s: BoardState) =>
  Object.keys(s.busy).length > 0;
/** 칸을 더할 수 있는지 (9칸 한도, 잠금) */
export const selectCanAddPanel = (s: BoardState) =>
  s.panelIds.length < MAX_PANELS && !selectLayoutLocked(s);
/** 칸을 지울 수 있는지 (마지막 한 칸은 지우지 않는다, 잠금) */
export const selectCanRemovePanel = (s: BoardState) =>
  s.panelIds.length > 1 && !selectLayoutLocked(s);
/** 칸 번호 (1부터). 없는 칸이면 0 */
export const selectPanelNumber = (panelId: string) => (s: BoardState) =>
  s.panelIds.indexOf(panelId) + 1;
/** 칸의 작업 store. 칸이 없으면 undefined */
export const selectPanelStore = (panelId: string) => (s: BoardState) =>
  s.panels[panelId] as WorkspaceStore | undefined;
export const selectActivePanelStore = (s: BoardState) =>
  s.panels[s.activePanelId];
export const selectIsActive = (panelId: string) => (s: BoardState) =>
  s.activePanelId === panelId;
export const selectIsMaximized = (panelId: string) => (s: BoardState) =>
  s.maximizedPanelId === panelId;
export const selectPanelBusy = (panelId: string) => (s: BoardState) =>
  s.busy[panelId] === true;

/**
 * 자동 저장에 보낼 모양 (PUT /analytics/board). 칸 store의 지금 draft와 그린 차트 id를 읽는다.
 * 그린 차트가 있으면 chartId를 보내 서버가 그 차트의 설정·item 상태를 고정하게 한다.
 */
export function boardSaveBody(s: BoardState): SaveAnalyticsBoardRequest {
  return {
    layout: s.layout,
    activePanelId: s.activePanelId,
    panels: s.panelIds.map((id) => {
      const { draft, current } = s.panels[id].getState();
      const link = s.links[id];
      return {
        id,
        draft,
        ...(current ? { chartId: current.chartId } : {}),
        ...(link ? { link } : {}),
      };
    }),
  };
}

/** 칸 store의 job을 취소한다. 끝난 job이면 서버가 무시한다. */
function cancelPanel(store: WorkspaceStore) {
  const { current, itemJobs } = store.getState();
  for (const jobId of [current?.jobId, ...Object.values(itemJobs)])
    if (jobId) api.cancelJob(jobId).catch(() => {});
}

/** 지운 칸과 그 칸을 따르던 연결을 뺀다. */
function withoutLinks(
  links: Record<string, AnalyticsPanelLink>,
  removed: ReadonlySet<string>,
) {
  let changed = false;
  const next: Record<string, AnalyticsPanelLink> = {};
  for (const [id, link] of Object.entries(links)) {
    if (removed.has(id) || removed.has(link.follow)) changed = true;
    else next[id] = link;
  }
  return changed ? next : links;
}

/** 서버 기본값(GET /defaults)으로 빈 칸 하나인 보드를 만든다. */
export function createBoardStore(defaults: ChartDefaults) {
  const base = defaultSpec(defaults);
  const panelStore = (id: string, draft: Partial<ChartSpec>, mode: Mode) => {
    const store = createWorkspaceStore({
      kind: "panel",
      id,
      draft: { ...base, ...draft },
    });
    if (mode !== "normal") store.setState({ mode });
    return store;
  };
  const emptyBoard = (mode: Mode) => {
    const id = crypto.randomUUID();
    return {
      layout: leaf(id) as LayoutNode,
      panelIds: [id],
      panels: { [id]: panelStore(id, {}, mode) },
      activePanelId: id,
      maximizedPanelId: null,
      busy: {},
      mode,
      links: {},
    };
  };

  return createStore<BoardState>((set, get) => {
    /** 새 레이아웃과 칸 목록. 칸 번호 순서는 layout에서 다시 읽는다. */
    const relayout = (layout: LayoutNode) => ({
      layout,
      panelIds: panelIdsOf(layout),
      maximizedPanelId: null,
    });

    /** 칸들을 지운 뒤의 상태. 활성 칸이 지워지면 같은 번호(없으면 마지막) 칸을 고른다. */
    const dropPanels = (
      s: BoardState,
      layout: LayoutNode,
      removed: string[],
    ) => {
      const gone = new Set(removed);
      for (const id of removed) cancelPanel(s.panels[id]);
      const panels = { ...s.panels };
      const busy = { ...s.busy };
      for (const id of removed) {
        delete panels[id];
        delete busy[id];
      }
      const next = relayout(layout);
      const activePanelId = gone.has(s.activePanelId)
        ? next.panelIds[
            Math.min(
              s.panelIds.indexOf(s.activePanelId),
              next.panelIds.length - 1,
            )
          ]
        : s.activePanelId;
      return {
        ...next,
        panels,
        busy,
        activePanelId,
        links: withoutLinks(s.links, gone),
      };
    };

    return {
      ...emptyBoard("normal"),
      hydrated: false,

      activate: (panelId) =>
        set((s) =>
          s.activePanelId === panelId || !s.panels[panelId]
            ? s
            : { activePanelId: panelId, maximizedPanelId: null },
        ),

      addPanel: (draft) => {
        const s = get();
        if (!selectCanAddPanel(s)) return undefined;
        const id = crypto.randomUUID();
        const dataset = s.panels[s.activePanelId].getState().draft.dataset;
        const store = panelStore(id, { dataset, ...draft }, s.mode);
        set({
          ...relayout(addLeaf(s.layout, id)),
          panels: { ...s.panels, [id]: store },
          activePanelId: id,
        });
        return id;
      },

      removePanel: (panelId) => {
        const s = get();
        if (!s.panels[panelId] || !selectCanRemovePanel(s)) return;
        const layout = removeLeaf(s.layout, panelId);
        if (!layout) return;
        set(dropPanels(s, layout, [panelId]));
      },

      movePanel: (panelId, targetId, edge) => {
        const s = get();
        if (selectLayoutLocked(s)) return;
        const layout = moveLeaf(s.layout, panelId, targetId, edge);
        if (layout !== s.layout) set(relayout(layout));
      },

      resizeSplit: (path, ratios) => {
        const s = get();
        if (selectLayoutLocked(s)) return;
        const layout = setSplitRatios(s.layout, path, ratios);
        // 칸 목록은 그대로라 panelIds를 새로 만들지 않는다.
        if (layout !== s.layout) set({ layout, maximizedPanelId: null });
      },

      applyPreset: (presetId) => {
        const s = get();
        if (selectLayoutLocked(s)) return;
        const result = presetApplied(s.layout, presetId, () =>
          crypto.randomUUID(),
        );
        const dataset = s.panels[s.activePanelId].getState().draft.dataset;
        const dropped = dropPanels(s, result.layout, result.removed);
        const panels = { ...dropped.panels };
        for (const id of result.added)
          panels[id] = panelStore(id, { dataset }, s.mode);
        set({ ...dropped, panels });
      },

      setMaximized: (panelId) =>
        set((s) =>
          panelId === null
            ? { maximizedPanelId: null }
            : s.panels[panelId]
              ? { maximizedPanelId: panelId, activePanelId: panelId }
              : s,
        ),

      setPanelBusy: (panelId, busy) =>
        set((s) => {
          if (busy === (s.busy[panelId] === true)) return s;
          if (busy)
            return s.panels[panelId]
              ? { busy: { ...s.busy, [panelId]: true } }
              : s;
          const { [panelId]: _done, ...rest } = s.busy;
          return { busy: rest };
        }),

      setMode: (mode) => {
        set({ mode });
        for (const store of Object.values(get().panels)) {
          const { current, setMode } = store.getState();
          // 아직 그리지 않은 칸은 고른 모드를 두고, 그린 뒤 지원하지 않으면 setCurrent가 기본 모드로 돌린다.
          setMode(
            !current || modeSupported(mode, current.spec) ? mode : "normal",
          );
        }
      },

      setLink: (panelId, link) =>
        set((s) => {
          if (!s.panels[panelId]) return s;
          if (link === null) {
            if (!s.links[panelId]) return s;
            const { [panelId]: _removed, ...rest } = s.links;
            return { links: rest };
          }
          if (link.follow === panelId || !s.panels[link.follow]) return s;
          return { links: { ...s.links, [panelId]: link } };
        }),

      hydrate: (board) => {
        if (get().hydrated) return [];
        if (!board) {
          set({ hydrated: true });
          return [];
        }
        const s = get();
        const panels: Record<string, WorkspaceStore> = {};
        const links: Record<string, AnalyticsPanelLink> = {};
        const reopen: PanelToReopen[] = [];
        for (const panel of board.panels) {
          const store = panelStore(panel.id, panel.draft, s.mode);
          panels[panel.id] = store;
          if (panel.link) links[panel.id] = panel.link;
          if (panel.drawn)
            reopen.push({ panelId: panel.id, store, drawn: panel.drawn });
        }
        // 채우기 전에 쓰던 빈 칸은 버린다 (그린 것이 없으므로 취소할 job도 없다).
        for (const store of Object.values(s.panels)) cancelPanel(store);
        const layout = normalizeLayout(board.layout);
        const ids = panelIdsOf(layout);
        set({
          ...relayout(layout),
          panels,
          links,
          busy: {},
          activePanelId: panels[board.activePanelId]
            ? board.activePanelId
            : ids[0],
          hydrated: true,
        });
        // 칸 번호 순으로 다시 그리게 한다.
        return reopen.sort(
          (a, b) => ids.indexOf(a.panelId) - ids.indexOf(b.panelId),
        );
      },

      reset: () => {
        const s = get();
        for (const store of Object.values(s.panels)) cancelPanel(store);
        set(emptyBoard(s.mode));
      },
    };
  });
}

export type BoardStore = ReturnType<typeof createBoardStore>;

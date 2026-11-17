"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import type { ChartDefaults } from "@/shared/api/types";
import {
  type BoardState,
  type BoardStore,
  createBoardStore,
} from "./board-store";
import { WorkspaceScope } from "./workspace-scope";

const BoardContext = createContext<BoardStore | null>(null);

/**
 * analytics 보드 상태를 만든다. 세션 범위에 TabsScope와 나란히 둔다 (`/`와 `/analytics`를 오가도 남는다).
 * 이 컴포넌트가 사라지면(로그아웃) 보드와 칸 작업 상태도 함께 버려진다.
 */
export function BoardScope({
  defaults,
  children,
}: {
  /** 새 칸 draft의 기본값 (서버 GET /defaults) */
  defaults: ChartDefaults;
  children: ReactNode;
}) {
  const [store] = useState(() => createBoardStore(defaults));
  return <BoardContext value={store}>{children}</BoardContext>;
}

export function useBoardStore() {
  const store = useContext(BoardContext);
  if (!store) throw new Error("BoardScope 밖에서 보드 상태를 읽었습니다.");
  return store;
}

/** 보드 상태를 원자 단위로 고른다. 칸 목록은 panelIds를, 칸 하나는 board-store의 select* selector를 쓴다. */
export function useBoard<T>(selector: (s: BoardState) => T) {
  return useStore(useBoardStore(), selector);
}

/**
 * 칸 하나의 작업 상태로 아래를 감싼다. 안에서는 useWorkspace가 이 칸을 본다 (차트·item 조작·도구).
 * 지운 칸이면 아무것도 그리지 않는다.
 */
export function PanelScope({
  panelId,
  children,
}: {
  panelId: string;
  children: ReactNode;
}) {
  const store = useBoard((s) => s.panels[panelId]);
  if (!store) return null;
  return <WorkspaceScope store={store}>{children}</WorkspaceScope>;
}

/**
 * 활성 칸의 작업 상태로 아래를 감싼다 (왼쪽 패널, 필터 서랍, 차트 도구, 공유).
 * 칸을 바꾸면 아래를 다시 마운트해 이전 칸의 mutation 결과·입력 중 값이 새 칸에 남지 않게 한다.
 */
export function ActivePanelScope({ children }: { children: ReactNode }) {
  const id = useBoard((s) => s.activePanelId);
  const store = useBoard((s) => s.panels[s.activePanelId]);
  return (
    <WorkspaceScope key={id} store={store}>
      {children}
    </WorkspaceScope>
  );
}

/**
 * 보드 위젯이 칸 자리에 내용을 끼우는 주입점. 위젯은 칸 틀(손잡이·이름표·닫기·놓는 변)만 그리고
 * 칸 안은 view가 넘긴 이 함수로 그린다 (widget은 다른 widget을 import하지 않는다).
 * 위젯은 칸 id만 넘기고, 받은 쪽은 PanelScope로 감싸 그 칸의 store를 쓴다. 참조가 바뀌면 모든 칸이 다시 그려지므로
 * view는 이 함수를 컴포넌트 밖이나 useCallback으로 고정한다.
 */
export type RenderPanel = (panelId: string) => ReactNode;

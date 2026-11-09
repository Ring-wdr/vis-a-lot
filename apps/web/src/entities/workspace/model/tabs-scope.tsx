"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import type { ChartDefaults } from "@/shared/api/types";
import {
  createTabsStore,
  type TabsState,
  type TabsStore,
  type View,
} from "./tabs-store";

const TabsContext = createContext<TabsStore | null>(null);

/** 아래 화면이 쓸 탭 상태를 만든다. 이 컴포넌트가 사라지면(로그아웃) 탭과 작업 상태도 함께 버려진다. */
export function TabsScope({
  defaults,
  initialView,
  children,
}: {
  /** 새 탭 draft의 기본값 (서버 GET /defaults) */
  defaults: ChartDefaults;
  /** 처음 보여줄 view. 탭 상태를 만들 때 한 번 부른다. 없으면 시작 화면부터 보여준다. */
  initialView?: () => View | null;
  children: ReactNode;
}) {
  const [store] = useState(() =>
    createTabsStore(defaults, initialView?.() ?? null),
  );
  return <TabsContext value={store}>{children}</TabsContext>;
}

export function useTabsStore() {
  const store = useContext(TabsContext);
  if (!store) throw new Error("TabsScope 밖에서 탭 상태를 읽었습니다.");
  return store;
}

export function useTabs<T>(selector: (s: TabsState) => T) {
  return useStore(useTabsStore(), selector);
}

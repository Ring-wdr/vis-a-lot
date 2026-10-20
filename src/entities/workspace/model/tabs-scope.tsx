"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import { createTabsStore, type TabsState, type TabsStore } from "./tabs-store";

const TabsContext = createContext<TabsStore | null>(null);

/** 아래 화면이 쓸 탭 상태를 만든다. 이 컴포넌트가 사라지면(로그아웃) 탭과 작업 상태도 함께 버려진다. */
export function TabsScope({ children }: { children: ReactNode }) {
  const [store] = useState(createTabsStore);
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

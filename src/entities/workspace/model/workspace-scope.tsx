"use client";

import { createContext, type ReactNode, useContext } from "react";
import { useStore } from "zustand";
import type { WorkspaceState, WorkspaceStore } from "./workspace-store";

const WorkspaceContext = createContext<WorkspaceStore | null>(null);

/** 아래 컴포넌트들이 쓸 작업 상태(gallery 또는 history)를 정한다. */
export function WorkspaceScope({
  store,
  children,
}: {
  store: WorkspaceStore;
  children: ReactNode;
}) {
  return <WorkspaceContext value={store}>{children}</WorkspaceContext>;
}

export function useWorkspaceStore() {
  const store = useContext(WorkspaceContext);
  if (!store) throw new Error("WorkspaceScope 밖에서 작업 상태를 읽었습니다.");
  return store;
}

export function useWorkspace<T>(selector: (state: WorkspaceState) => T) {
  return useStore(useWorkspaceStore(), selector);
}

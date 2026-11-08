"use client";

import { useIsMutating } from "@tanstack/react-query";
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

/**
 * 이 탭의 mutation key. 탭을 바꾸면 화면이 다시 마운트돼 useMutation의 isPending이 사라지므로,
 * 돌아왔을 때도 진행 중인지 알 수 있게 key로 찾는다 (useWorkspaceMutating).
 */
export function useWorkspaceMutationKey(...parts: string[]) {
  const id = useWorkspace((s) => s.id);
  return [...parts, id];
}

export function useWorkspaceMutating(...parts: string[]) {
  const mutationKey = useWorkspaceMutationKey(...parts);
  return useIsMutating({ mutationKey }) > 0;
}

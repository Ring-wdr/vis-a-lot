// 다른 페이지(공유 페이지)에서 gallery 탭에 열어 달라고 맡겨 둔 차트.
// 그 탭이 화면에 붙어 grid 크기를 안 뒤에 Workspace가 꺼내 연다.

import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import type { OpenChartInput } from "./open-chart";

const pending = new WeakMap<WorkspaceStore, OpenChartInput>();

export function queueOpen(store: WorkspaceStore, input: OpenChartInput) {
  pending.set(store, input);
}

/** 맡겨 둔 차트를 꺼낸다. 한 번 꺼내면 지운다. */
export function takeQueuedOpen(store: WorkspaceStore) {
  const input = pending.get(store);
  pending.delete(store);
  return input;
}

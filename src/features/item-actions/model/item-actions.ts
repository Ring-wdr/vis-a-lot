"use client";

import { useMutation } from "@tanstack/react-query";
import {
  useWorkspace,
  useWorkspaceMutating,
  useWorkspaceMutationKey,
} from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import type {
  LegendPosition,
  Region,
  Shape,
  ViewRequest,
} from "@/shared/api/types";

export type ItemAction =
  | { type: "view"; body: ViewRequest }
  | { type: "addShape"; shape: Shape }
  | { type: "undoShape" }
  | { type: "color"; color: string | null }
  | { type: "legendColor"; value: string; color: string | null }
  | { type: "legendPosition"; position: LegendPosition | null }
  | { type: "clearShapes" }
  | { type: "select"; region: Region | null }
  | { type: "deleteRegion"; region: Region }
  | { type: "undoDeletion" }
  | { type: "clearDeletions" }
  | { type: "addFavorite"; name: string }
  | { type: "removeFavorite"; name: string }
  | { type: "addLegendGroup"; name: string }
  | { type: "removeLegendGroup"; name: string };

/**
 * item 단위 조작. 서버는 바뀐 상태를 저장하고 그 item만 다시 그리는 job id를 돌려준다.
 * job이 끝날 때까지 그 item은 조작이 막힌다.
 */
export function useItemAction(chartId: string, itemKey: string) {
  const setItemJob = useWorkspace((s) => s.setItemJob);
  const changeUndo = useWorkspace((s) => s.changeUndo);
  const notify = useWorkspace((s) => s.notify);

  return useMutation({
    mutationKey: useWorkspaceMutationKey("item", chartId, itemKey),
    mutationFn: (action: ItemAction) => {
      switch (action.type) {
        case "view":
          return api.changeView(chartId, itemKey, action.body);
        case "addShape":
          return api.addShape(chartId, itemKey, { shape: action.shape });
        case "undoShape":
          return api.undoShape(chartId, itemKey);
        case "color":
          return api.setItemColor(chartId, itemKey, action.color);
        case "legendColor":
          return api.setItemLegendColor(
            chartId,
            itemKey,
            action.value,
            action.color,
          );
        case "clearShapes":
          return api.clearShapes(chartId, itemKey);
        case "legendPosition":
          return api.setItemLegendPosition(chartId, itemKey, action.position);
        case "deleteRegion":
          return api.addDeletion(chartId, itemKey, action.region);
        case "undoDeletion":
          return api.undoDeletion(chartId, itemKey);
        case "clearDeletions":
          return api.clearDeletions(chartId, itemKey);
        case "select":
          return api.setSelection(chartId, itemKey, action.region);
        case "addFavorite":
          return api.addFavorite(chartId, itemKey, action.name);
        case "removeFavorite":
          return api.removeFavorite(chartId, itemKey, action.name);
        case "addLegendGroup":
          return api.addLegendGroup(chartId, itemKey, action.name);
        case "removeLegendGroup":
          return api.removeLegendGroup(chartId, itemKey, action.name);
      }
    },
    onSuccess: ({ jobId }, action) => {
      setItemJob(itemKey, jobId);
      if (action.type === "addShape") changeUndo(itemKey, 1);
      if (action.type === "undoShape") changeUndo(itemKey, -1);
      if (action.type === "clearShapes") changeUndo(itemKey, "reset");
    },
    onError: (err) => notify(err.message),
  });
}

/** 이 item의 조작 요청이 아직 응답을 기다리는 중인지. 탭을 오가 다시 마운트돼도 이어진다. */
export function useItemActionPending(chartId: string, itemKey: string) {
  return useWorkspaceMutating("item", chartId, itemKey);
}

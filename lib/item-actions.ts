"use client";

import { useMutation } from "@tanstack/react-query";
import type { Shape, ViewRequest } from "@/server/api/types";
import { useAlert } from "./alert-store";
import { api } from "./api";
import { useWorkspace } from "./workspace-store";

export type ItemAction =
  | { type: "view"; body: ViewRequest }
  | { type: "addShape"; shape: Shape }
  | { type: "undoShape" }
  | { type: "color"; color: string | null }
  | { type: "legendColor"; value: string; color: string | null }
  | { type: "clearShapes" };

/**
 * item 단위 조작. 서버는 바뀐 상태를 저장하고 그 item만 다시 그리는 job id를 돌려준다.
 * job이 끝날 때까지 그 item은 조작이 막힌다.
 */
export function useItemAction(chartId: string, itemKey: string) {
  const setItemJob = useWorkspace((s) => s.setItemJob);
  const changeUndo = useWorkspace((s) => s.changeUndo);
  const showAlert = useAlert((s) => s.show);

  return useMutation({
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
      }
    },
    onSuccess: ({ jobId }, action) => {
      setItemJob(itemKey, jobId);
      if (action.type === "addShape") changeUndo(itemKey, 1);
      if (action.type === "undoShape") changeUndo(itemKey, -1);
      if (action.type === "clearShapes") changeUndo(itemKey, "reset");
    },
    onError: (err) => showAlert(err.message),
  });
}

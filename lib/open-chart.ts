"use client";

import { useMutation } from "@tanstack/react-query";
import type { ChartSpec, ItemRestore } from "@/server/api/types";
import { useAlert } from "./alert-store";
import { api } from "./api";
import { itemSizeFor } from "./grid-layout";
import { useWorkspace } from "./workspace-store";

export type OpenChartInput = {
  spec: ChartSpec;
  restore?: Record<string, ItemRestore>;
  /** history에서 불러오면 그 건에 이어서 기록한다. 공유 링크는 새 건으로 남긴다. */
  historyId?: string;
};

/**
 * 저장된 설정으로 차트를 다시 그린다 (history 복원, 공유 링크).
 * 데이터는 시드로 다시 만들 수 있으므로 설정과 item 상태만 있으면 같은 차트가 된다.
 */
export function useOpenChart() {
  const setDraft = useWorkspace((s) => s.setDraft);
  const setCurrent = useWorkspace((s) => s.setCurrent);
  const showAlert = useAlert((s) => s.show);

  return useMutation({
    mutationFn: async ({ spec, restore, historyId }: OpenChartInput) => {
      const gridArea = useWorkspace.getState().gridArea;
      if (!gridArea) throw new Error("grid 영역 크기를 아직 모릅니다.");
      const res = await api.createChart({
        spec,
        itemSize: itemSizeFor(gridArea, spec.grid),
        restore,
        historyId,
      });
      return { res, spec };
    },
    onSuccess: ({ res, spec }) => {
      setDraft(spec);
      setCurrent({ ...res, spec });
    },
    onError: (err) => showAlert(err.message),
  });
}

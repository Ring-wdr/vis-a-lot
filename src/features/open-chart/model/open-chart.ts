"use client";

import { useMutation } from "@tanstack/react-query";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import { useWorkspaceStore } from "@/entities/workspace/model/workspace-scope";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { api } from "@/shared/api/api";
import type { ChartSpec, ItemRestore } from "@/shared/api/types";
import { showAlert } from "@/shared/ui/AlertDialog";

export type OpenChartInput = {
  spec: ChartSpec;
  restore?: Record<string, ItemRestore>;
  /** history에서 불러오면 그 건에 이어서 기록한다. 공유 링크는 새 건으로 남긴다. */
  historyId?: string;
};

/**
 * 저장된 설정으로 차트를 다시 그린다 (history 복원, 공유 링크).
 * 데이터는 시드로 다시 만들 수 있으므로 설정과 item 상태만 있으면 같은 차트가 된다.
 * store를 주면 그 화면에 연다 (history에서 gallery로 넘길 때). 다시 보기 전용 store면 history에 기록하지 않는다.
 */
export function useOpenChart(target?: WorkspaceStore) {
  const scoped = useWorkspaceStore();
  const store = target ?? scoped;

  return useMutation({
    mutationFn: async ({ spec, restore, historyId }: OpenChartInput) => {
      const { gridArea, readOnly } = store.getState();
      // 아직 한 번도 보지 않은 화면이면 지금 보이는 grid 영역 크기를 쓴다. 다르면 열린 뒤 resize가 맞춘다.
      const area = gridArea ?? scoped.getState().gridArea;
      if (!area) throw new Error("grid 영역 크기를 아직 모릅니다.");
      const res = await api.createChart({
        spec,
        itemSize: itemSizeFor(area, spec.grid),
        restore,
        historyId: readOnly ? undefined : historyId,
        record: !readOnly,
      });
      // 다시 보기는 history를 새로 만들지 않으므로 보고 있는 건의 id를 들고 있는다 (공유 링크용).
      return {
        res: { ...res, historyId: res.historyId || historyId || "" },
        spec,
      };
    },
    onSuccess: ({ res, spec }) => {
      const { setDraft, setCurrent } = store.getState();
      setDraft(spec);
      setCurrent({ ...res, spec });
    },
    onError: (err) => showAlert(err.message),
  });
}

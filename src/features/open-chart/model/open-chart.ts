"use client";

import { useMutation } from "@tanstack/react-query";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import { useWorkspaceStore } from "@/entities/workspace/model/workspace-scope";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { api } from "@/shared/api/api";
import type { ChartSpec, ItemRestore } from "@/shared/api/types";

export type OpenChartInput = {
  spec: ChartSpec;
  restore?: Record<string, ItemRestore>;
  /** history에서 불러오면 그 건에 이어서 기록한다. 공유 링크는 새 건으로 남긴다. */
  historyId?: string;
};

type Size = { width: number; height: number };

/**
 * 저장된 설정으로 차트를 다시 그려 store(탭)에 연다 (history 복원, 공유 링크, gallery에서 편집).
 * 데이터는 시드로 다시 만들 수 있으므로 설정과 item 상태만 있으면 같은 차트가 된다.
 * 아직 한 번도 보이지 않은 탭이면 지금 보이는 grid 영역 크기를 쓴다. 다르면 열린 뒤 resize가 맞춘다.
 * 다시 보기 전용 store면 history에 기록하지 않는다.
 */
export async function openChartIn(
  store: WorkspaceStore,
  { spec, restore, historyId }: OpenChartInput,
  fallbackArea?: Size,
) {
  const { gridArea, readOnly } = store.getState();
  const area = gridArea ?? fallbackArea;
  if (!area) throw new Error("grid 영역 크기를 아직 모릅니다.");
  // 여는 동안 그 탭에서 따로 draw하면 늦게 온 쪽이 앞의 차트를 덮으므로 막는다.
  store.setState({ opening: true });
  try {
    const res = await api.createChart({
      spec,
      itemSize: itemSizeFor(area, spec.grid),
      restore,
      historyId: readOnly ? undefined : historyId,
      record: !readOnly,
    });
    const { setDraft, setCurrent } = store.getState();
    setDraft(spec);
    // 다시 보기는 history를 새로 만들지 않으므로 보고 있는 건의 id를 들고 있는다 (공유 링크용).
    setCurrent({ ...res, historyId: res.historyId || historyId || "", spec });
  } finally {
    store.setState({ opening: false });
  }
}

/** 지금 보이는 탭 또는 지정한 탭(store)에 차트를 연다. */
export function useOpenChart() {
  const scoped = useWorkspaceStore();
  return useMutation({
    mutationFn: ({
      store = scoped,
      ...input
    }: OpenChartInput & { store?: WorkspaceStore }) =>
      openChartIn(store, input, scoped.getState().gridArea),
    // 연 탭에 알린다. 그 탭을 보고 있지 않으면 돌아왔을 때 뜬다.
    onError: (err, { store = scoped }) => store.getState().notify(err.message),
  });
}

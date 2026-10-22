"use client";

import { useEffect } from "react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useItemAction } from "@/features/item-actions/model/item-actions";
import { useDebounced } from "@/shared/lib/use-debounced";

/** item 속성을 이만큼 바꾸지 않아야 보낸다. 연달아 바꾸면 마지막 값만 한 번 보낸다. */
const ITEM_SEND_DELAY_MS = 500;

/**
 * 차트 속성 패널에서 바꾼 item 속성을 서버에 보낸다. 작업 화면에 하나만 둔다 (패널을 닫아도 남은 값을 보낸다).
 * - 마지막 변경 뒤 ITEM_SEND_DELAY_MS 동안 더 바꾸지 않으면 그때의 item 속성 전체를 한 번 보낸다.
 * - 그 item을 다시 그리는 중이면 끝날 때까지 기다렸다가 마지막 값만 보낸다 (서버는 그리는 중인 item을 거절한다).
 */
export function useItemOptionsSync() {
  const item = useWorkspace((s) => s.optionsItem);
  const updateOptionsItem = useWorkspace((s) => s.updateOptionsItem);
  const busy = useWorkspace(
    (s) => item !== null && s.itemJobs[item.key] !== undefined,
  );
  const action = useItemAction(item?.chartId ?? "", item?.key ?? "");
  const settled =
    useDebounced(item?.options, ITEM_SEND_DELAY_MS) === item?.options;

  useEffect(() => {
    if (!item?.dirty || !settled || busy || action.isPending) return;
    updateOptionsItem({ dirty: false });
    action.mutate({ type: "options", options: item.options ?? null });
  }, [item, settled, busy, updateOptionsItem, action.isPending, action.mutate]);
}

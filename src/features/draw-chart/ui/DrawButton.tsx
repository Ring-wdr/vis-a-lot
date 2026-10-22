"use client";

import { useMutation } from "@tanstack/react-query";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import { DELETED_DATASET_HINT } from "@/entities/dataset/lib/labels";
import {
  useWorkspace,
  useWorkspaceMutationKey,
} from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import {
  useCancelJob,
  useDatasetSchema,
  useDatasetStatus,
  useSchemaState,
} from "@/shared/api/queries";
import { Spinner } from "@/shared/ui/Loading";
import styles from "@/shared/ui/workspace.module.css";
import { useDrawState } from "../model/draw-state";

/**
 * draw → pending(비활성) → 서버에서 작업 상태를 받으면 cancel → job이 끝나면 다시 draw.
 */
export function DrawButton() {
  const draft = useWorkspace((s) => s.draft);
  const gridArea = useWorkspace((s) => s.gridArea);
  const current = useWorkspace((s) => s.current);
  const setCurrent = useWorkspace((s) => s.setCurrent);
  const notify = useWorkspace((s) => s.notify);
  const cancel = useCancelJob();
  const dataset = useDatasetStatus(draft.dataset);

  // 컬럼은 데이터셋 스키마에서 고르므로, 스키마를 받고 x·y가 정해져야 그릴 수 있다.
  const schema = useDatasetSchema(draft.dataset);
  const ready = schema.data !== undefined && draft.x !== "" && draft.y !== "";
  const deleted = useSchemaState(draft.dataset) === "deleted";

  const draw = useMutation({
    mutationKey: useWorkspaceMutationKey("draw"),
    mutationFn: async () => {
      if (!gridArea) throw new Error("grid 영역 크기를 아직 모릅니다.");
      // 데이터가 준비돼 있으면 split 조합 개수를 미리 확인한다. 아직 없으면 job이 확인한다.
      if (draft.splitBy.length > 0 && dataset.data?.state === "ready") {
        // 최대 개수는 서버가 정해 응답에 담아 준다.
        const { count, limit } = await api.splitCount(
          draft.dataset,
          draft.splitBy,
          draft.filters,
        );
        if (count > limit) {
          notify(
            `split 조합이 ${count.toLocaleString()}개입니다. 최대 ${limit.toLocaleString()}개까지 그릴 수 있습니다.`,
          );
          return undefined;
        }
      }
      return api.createChart({
        spec: draft,
        itemSize: itemSizeFor(gridArea, draft.grid),
      });
    },
    onSuccess: (res) => res && setCurrent({ ...res, spec: draft }),
  });

  // 탭을 오가 다시 마운트돼도 이 탭의 draw가 진행 중이면 다시 누를 수 없게 한다.
  const state = useDrawState();

  return (
    <>
      {state === "cancel" ? (
        <button
          type="button"
          className={styles.cancelButton}
          disabled={cancel.isPending}
          onClick={() => current && cancel.mutate(current.jobId)}
        >
          cancel
        </button>
      ) : (
        <button
          type="button"
          className={styles.drawButton}
          disabled={state === "pending" || !gridArea || !ready || deleted}
          title={
            deleted
              ? DELETED_DATASET_HINT
              : ready
                ? undefined
                : "데이터를 등록하고 x, y를 고르면 그릴 수 있습니다"
          }
          aria-busy={state === "pending"}
          onClick={() => draw.mutate()}
        >
          {state === "pending" ? (
            <>
              <Spinner size="sm" tone="inherit" />
              pending
            </>
          ) : (
            "draw"
          )}
        </button>
      )}
      {(draw.error ?? cancel.error) && (
        <p role="alert" className={styles.error}>
          {(draw.error ?? cancel.error)?.message}
        </p>
      )}
    </>
  );
}

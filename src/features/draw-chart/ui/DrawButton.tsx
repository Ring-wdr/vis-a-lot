"use client";

import { isTerminal } from "@server/api/types";
import { MAX_SPLIT_ITEMS } from "@server/data/schema";
import { useMutation } from "@tanstack/react-query";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import { useWorkspace } from "@/entities/workspace/model/workspace-store";
import { api } from "@/shared/api/api";
import {
  useCancelJob,
  useDatasetStatus,
  useJobProgress,
} from "@/shared/api/queries";
import { useAlert } from "@/shared/ui/alert-store";
import styles from "@/shared/ui/workspace.module.css";

type ButtonState = "draw" | "pending" | "cancel";

/**
 * draw → pending(비활성) → 서버에서 작업 상태를 받으면 cancel → job이 끝나면 다시 draw.
 */
export function DrawButton() {
  const draft = useWorkspace((s) => s.draft);
  const gridArea = useWorkspace((s) => s.gridArea);
  const current = useWorkspace((s) => s.current);
  const setCurrent = useWorkspace((s) => s.setCurrent);
  const job = useJobProgress(current?.jobId);
  const cancel = useCancelJob();
  const dataset = useDatasetStatus(draft.rows);
  const showAlert = useAlert((s) => s.show);

  const draw = useMutation({
    mutationFn: async () => {
      if (!gridArea) throw new Error("grid 영역 크기를 아직 모릅니다.");
      // 데이터가 준비돼 있으면 split 조합 개수를 미리 확인한다. 아직 없으면 job이 확인한다.
      if (draft.splitBy.length > 0 && dataset.data?.state === "ready") {
        const { count } = await api.splitCount(draft.rows, draft.splitBy);
        if (count > MAX_SPLIT_ITEMS) {
          showAlert(
            `split 조합이 ${count.toLocaleString()}개입니다. 최대 ${MAX_SPLIT_ITEMS.toLocaleString()}개까지 그릴 수 있습니다.`,
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

  const state: ButtonState =
    draw.isPending || (current && !job.data)
      ? "pending"
      : current && job.data && !isTerminal(job.data.status)
        ? "cancel"
        : "draw";

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
          disabled={state === "pending" || !gridArea}
          aria-busy={state === "pending"}
          onClick={() => draw.mutate()}
        >
          {state === "pending" ? "pending" : "draw"}
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

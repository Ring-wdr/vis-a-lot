"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { itemSizeFor } from "@/lib/grid-layout";
import { useCancelJob, useJob } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace-store";
import { isTerminal } from "@/server/api/types";
import styles from "./Workspace.module.css";

type ButtonState = "draw" | "pending" | "cancel";

/**
 * draw → pending(비활성) → 서버에서 작업 상태를 받으면 cancel → job이 끝나면 다시 draw.
 */
export function DrawButton() {
  const draft = useWorkspace((s) => s.draft);
  const gridArea = useWorkspace((s) => s.gridArea);
  const current = useWorkspace((s) => s.current);
  const page = useWorkspace((s) => s.page);
  const setCurrent = useWorkspace((s) => s.setCurrent);
  const grid = current?.spec.grid;
  const job = useJob(current?.jobId, page, grid ? grid.rows * grid.cols : 1);
  const cancel = useCancelJob();

  const draw = useMutation({
    mutationFn: () => {
      if (!gridArea) throw new Error("grid 영역 크기를 아직 모릅니다.");
      return api.createChart({
        spec: draft,
        itemSize: itemSizeFor(gridArea, draft.grid),
      });
    },
    onSuccess: (res) => setCurrent({ ...res, spec: draft }),
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

"use client";

import { isTerminal } from "@server/api/types";
import { useMutation } from "@tanstack/react-query";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import { useWorkspace } from "@/entities/workspace/model/workspace-store";
import { api } from "@/shared/api/api";
import { useJobProgress } from "@/shared/api/queries";
import { useAlert } from "@/shared/ui/alert-store";
import styles from "@/shared/ui/workspace.module.css";

const GRID_SIZES = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * n x n grid 크기. 그린 차트가 있으면 draw 없이 바로 전체를 다시 그린다.
 * 렌더링 중에는 바꿀 수 없고 팝업으로 알린다.
 */
export function GridSelect() {
  const draft = useWorkspace((s) => s.draft);
  const current = useWorkspace((s) => s.current);
  const page = useWorkspace((s) => s.page);
  const gridArea = useWorkspace((s) => s.gridArea);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const replaceJob = useWorkspace((s) => s.replaceJob);
  const showAlert = useAlert((s) => s.show);
  const grid = current?.spec.grid;
  const pageSize = grid ? grid.rows * grid.cols : 1;
  const job = useJobProgress(current?.jobId);

  const change = useMutation({
    mutationFn: (n: number) => {
      if (!current || !gridArea) throw new Error("no chart");
      return api.changeGrid(
        current.chartId,
        { rows: n, cols: n },
        itemSizeFor(gridArea, { rows: n, cols: n }),
      );
    },
    onSuccess: ({ jobId }, n) => {
      if (!current) return;
      // 보던 첫 item이 새 페이지 크기에서도 보이도록 페이지를 맞춘다.
      const firstItem = page * pageSize;
      replaceJob(
        jobId,
        { ...current.spec, grid: { rows: n, cols: n } },
        Math.floor(firstItem / (n * n)),
      );
    },
    onError: (err) => {
      showAlert(err.message);
      if (current) updateDraft({ grid: current.spec.grid });
    },
  });

  const rendering =
    current !== undefined && (!job.data || !isTerminal(job.data.status));

  return (
    <label className={styles.field}>
      <span>Grid</span>
      <select
        value={draft.grid.rows}
        disabled={change.isPending}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (current && rendering) {
            showAlert(
              "렌더링 중에는 grid 크기를 바꿀 수 없습니다. 끝나거나 취소한 뒤에 바꿔 주세요.",
            );
            return;
          }
          updateDraft({ grid: { rows: n, cols: n } });
          if (current && n !== current.spec.grid.rows) change.mutate(n);
        }}
      >
        {GRID_SIZES.map((n) => (
          <option key={n} value={n}>
            {n} x {n}
          </option>
        ))}
      </select>
    </label>
  );
}

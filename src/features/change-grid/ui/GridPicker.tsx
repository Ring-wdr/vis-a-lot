"use client";

import { useMutation } from "@tanstack/react-query";
import { Grid3x3 } from "lucide-react";
import { useState } from "react";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import { useJobProgress } from "@/shared/api/queries";
import { isTerminal } from "@/shared/api/types";
import { showAlert } from "@/shared/ui/AlertDialog";
import { Popover } from "@/shared/ui/Popover";
import styles from "./GridPicker.module.css";

const MAX = 10;
const CELLS = Array.from({ length: MAX * MAX }, (_, i) => ({
  row: Math.floor(i / MAX),
  col: i % MAX,
}));

/**
 * n x n grid 크기. Excel의 표 삽입처럼 칸 위에 올리면 크기가 미리 보이고, 누르면 정해진다.
 * grid는 정사각형이라 올린 칸의 행·열 중 큰 쪽이 n이 된다.
 * 그린 차트가 있으면 draw 없이 바로 전체를 다시 그리고, 렌더링 중에는 바꿀 수 없어 팝업으로 알린다.
 */
export function GridPicker() {
  const draft = useWorkspace((s) => s.draft);
  const current = useWorkspace((s) => s.current);
  const page = useWorkspace((s) => s.page);
  const gridArea = useWorkspace((s) => s.gridArea);
  const readOnly = useWorkspace((s) => s.readOnly);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const replaceJob = useWorkspace((s) => s.replaceJob);
  const [hover, setHover] = useState<number>();
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
  const selected = draft.grid.rows;
  const preview = hover ?? selected;

  const pick = (n: number) => {
    if (current && rendering) {
      showAlert(
        "렌더링 중에는 grid 크기를 바꿀 수 없습니다. 끝나거나 취소한 뒤에 바꿔 주세요.",
      );
      return;
    }
    updateDraft({ grid: { rows: n, cols: n } });
    if (current && n !== current.spec.grid.rows) change.mutate(n);
  };

  return (
    <div className={styles.field}>
      <span>Grid</span>
      <Popover
        triggerClassName={styles.trigger}
        disabled={readOnly || change.isPending}
        width={MAX * 20 + 24}
        trigger={
          <>
            <Grid3x3 size={14} aria-hidden="true" />
            {selected} x {selected}
          </>
        }
      >
        {(close) => (
          <div className={styles.picker}>
            <div
              className={styles.cells}
              style={{ gridTemplateColumns: `repeat(${MAX}, 1fr)` }}
              onPointerLeave={() => setHover(undefined)}
            >
              {CELLS.map(({ row, col }) => {
                const n = Math.max(row, col) + 1;
                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    className={styles.cell}
                    aria-label={`${n} x ${n}`}
                    data-active={(row < preview && col < preview) || undefined}
                    data-selected={
                      (row < selected && col < selected) || undefined
                    }
                    onPointerEnter={() => setHover(n)}
                    onFocus={() => setHover(n)}
                    onClick={() => {
                      pick(n);
                      setHover(undefined);
                      close();
                    }}
                  />
                );
              })}
            </div>
            <span className={styles.caption} aria-live="polite">
              {preview} x {preview}
              {preview !== selected && ` (현재 ${selected} x ${selected})`}
            </span>
          </div>
        )}
      </Popover>
    </div>
  );
}
